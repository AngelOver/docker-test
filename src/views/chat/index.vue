<script setup lang='ts'>
import type { Ref } from 'vue'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { MessageReactive } from 'naive-ui'
import { NAutoComplete, NButton, NInput, NSpin, useDialog, useMessage } from 'naive-ui'
import html2canvas from 'html2canvas'
import { Message } from './components'
import { useScroll } from './hooks/useScroll'
import { useChat } from './hooks/useChat'
import { useCopyCode } from './hooks/useCopyCode'
import { useUsingContext } from './hooks/useUsingContext'
import HeaderComponent from './components/Header/index.vue'
import { HoverButton, SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useAuthStore, useChatStore, usePromptStore } from '@/store'
import { fetchChatAPIProcess } from '@/api'
import { t } from '@/locales'
import { debounce } from '@/utils/functions/debounce'
import IconPrompt from '@/icons/Prompt.vue'
const Prompt = defineAsyncComponent(() => import('@/components/common/Setting/Prompt.vue'))

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()
const authStore = useAuthStore()

const chatStore = useChatStore()

useCopyCode()
let mj_1chat = 'https://mj.c3r.ink'
let imageUrl_wxzs = 'https://qiniuchat.littlewheat.com/other/wx/wxzs.jpg?t=' + Date.now()
let downUrl_1chat = 'https://qiniuchat.littlewheat.com/other/app/android/1chat.apk?t=' + Date.now()
let downUrl_chatcn = 'https://qiniuchat.littlewheat.com/other/app/android/ChatGPT%E5%9B%BD%E5%86%85%E7%89%88.apk?t=' + Date.now()

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom, scrollTo } = useScroll()
const { usingContext, toggleUsingContext } = useUsingContext()

const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !!item.conversationOptions)))

const prompt = ref<string>('')
const firstLoading = ref<boolean>(false)
const loading = ref<boolean>(false)
const inputRef = ref<Ref | null>(null)
const showPrompt = ref(false)

let showDraw =  ref<boolean>(false)

let loadingms: MessageReactive
let allmsg: MessageReactive
let prevScrollTop: number
let isFist =ref<boolean>(true)

if(usingContext.value){
	chatStore.setUsingContext(!usingContext.value)
}

// 添加PromptStore
const promptStore = usePromptStore()

// 使用storeToRefs，保证store修改后，联想部分能够重新渲染
const { promptList: promptTemplate } = storeToRefs<any>(promptStore)

// 未知原因刷新页面，loading 状态不会重置，手动重置
dataSources.value.forEach((item, index) => {
  if (item.loading)
    updateChatSome(+uuid, index, { loading: false })
})

function handleSubmit() {
	if (isFist.value){
		isFist.value = false
	}
  onConversation()
}

async function onConversation() {
  let message = prompt.value
	let draw = showDraw.value

  if (loading.value)
    return

  if (!message || message.trim() === '')
    return

  controller = new AbortController()

  const chatUuid = Date.now()
  addChat(
    +uuid,
    {
      uuid: chatUuid,
      dateTime: new Date().toLocaleString(),
      text: message,
      inversion: true,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: null },
    },
  )
  scrollToBottom()

  loading.value = true
  prompt.value = ''

  let options: Chat.ConversationRequest = {}
  const lastContext = conversationList.value[conversationList.value.length - 1]?.conversationOptions

  if (lastContext && usingContext.value)
    options = { ...lastContext }

  addChat(
    +uuid,
    {
      uuid: chatUuid,
      dateTime: new Date().toLocaleString(),
      text: '',
      loading: true,
      inversion: false,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )
  scrollToBottom()

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        roomId: +uuid,
        uuid: chatUuid,
        prompt: message,
				draw: draw,
        options,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            const usage = (data.detail && data.detail.usage)
              ? {
                  completion_tokens: data.detail.usage.completion_tokens || null,
                  prompt_tokens: data.detail.usage.prompt_tokens || null,
                  total_tokens: data.detail.usage.total_tokens || null,
                  estimated: data.detail.usage.estimated || null,
                }
              : undefined
            updateChat(
              +uuid,
              dataSources.value.length - 1,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (data.text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
                usage,
              },
            )

            if (openLongReply && data.detail && data.detail.choices.length > 0 && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }

            scrollToBottomIfAtBottom()
          }
          catch (error) {
            //
          }
        },
      })
      updateChatSome(+uuid, dataSources.value.length - 1, { loading: false })
    }

    await fetchChatAPIOnce()
		scrollToBottomIfAtBottom()
  }
  catch (error: any) {
    const errorMessage = error?.message ?? t('common.wrong')

    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          loading: false,
        },
      )
      scrollToBottomIfAtBottom()
      return
    }

    const currentChat = getChatByUuidAndIndex(+uuid, dataSources.value.length - 1)

    if (currentChat?.text && currentChat.text !== '') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          text: `${currentChat.text}\n[${errorMessage}]`,
          error: false,
          loading: false,
        },
      )
      return
    }

    updateChat(
      +uuid,
      dataSources.value.length - 1,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
    scrollToBottomIfAtBottom()
  }
  finally {
    loading.value = false
  }
}

async function onRegenerate(index: number) {
  if (loading.value)
    return

  controller = new AbortController()

  const { requestOptions } = dataSources.value[index]

  let message = requestOptions?.prompt ?? ''
	let draw = showDraw.value

  let options: Chat.ConversationRequest = {}

  if (requestOptions.options)
    options = { ...requestOptions.options }

  loading.value = true
  const chatUuid = dataSources.value[index].uuid
  updateChat(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      inversion: false,
      error: false,
      loading: true,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        roomId: +uuid,
        uuid: chatUuid || Date.now(),
        regenerate: true,
        prompt: message,
				draw: draw,
        options,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            const usage = (data.detail && data.detail.usage)
              ? {
                  completion_tokens: data.detail.usage.completion_tokens || null,
                  prompt_tokens: data.detail.usage.prompt_tokens || null,
                  total_tokens: data.detail.usage.total_tokens || null,
                  estimated: data.detail.usage.estimated || null,
                }
              : undefined
            updateChat(
              +uuid,
              index,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (data.text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
                usage,
              },
            )

            if (openLongReply && data.detail && data.detail.choices.length > 0 && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }
          }
          catch (error) {
            //
          }
        },
      })
      updateChatSome(+uuid, index, { loading: false })
    }
    await fetchChatAPIOnce()
  }
  catch (error: any) {
    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        index,
        {
          loading: false,
        },
      )
      return
    }

    const errorMessage = error?.message ?? t('common.wrong')

    updateChat(
      +uuid,
      index,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
  }
  finally {
    loading.value = false
  }
}

function toggleDraw() {
	showDraw.value = !showDraw.value
	if (showDraw.value)
		ms.success("开启AI绘画模式")
	else
		ms.warning("关闭AI绘画模式 ，普通模式以“画” 这个字开头 即 输出图片")

	console.log(showDraw.value)
}

function handleExport() {
  if (loading.value)
    return

  const d = dialog.warning({
    title: t('chat.exportImage'),
    content: t('chat.exportImageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: async () => {
      try {
        d.loading = true
        const ele = document.getElementById('image-wrapper')
        const canvas = await html2canvas(ele as HTMLDivElement, {
          useCORS: true,
        })
        const imgUrl = canvas.toDataURL('image/png')
        const tempLink = document.createElement('a')
        tempLink.style.display = 'none'
        tempLink.href = imgUrl
        tempLink.setAttribute('download', 'chat-shot.png')
        if (typeof tempLink.download === 'undefined')
          tempLink.setAttribute('target', '_blank')

        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
        window.URL.revokeObjectURL(imgUrl)
        d.loading = false
        ms.success(t('chat.exportSuccess'))
        Promise.resolve()
      }
      catch (error: any) {
        ms.error(t('chat.exportFailed'))
      }
      finally {
        d.loading = false
      }
    },
  })
}

function handleDelete(index: number) {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.deleteMessageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index)
    },
  })
}

function handleClear() {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.clearChat'),
    content: t('chat.clearChatConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid)
    },
  })
}

function handleEnter(event: KeyboardEvent) {

  if (!isMobile.value) {
    if (event.code === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
  else {
    if (event.code === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
}

function handleStop() {
  if (loading.value) {
    controller.abort()
    loading.value = false
  }
}

async function loadMoreMessage(event: any) {
  const chatIndex = chatStore.chat.findIndex(d => d.uuid === +uuid)
  if (chatIndex <= -1)
    return

  const scrollPosition = event.target.scrollHeight - event.target.scrollTop

  const lastId = chatStore.chat[chatIndex].data[0].uuid
  await chatStore.syncChat({ uuid: +uuid } as Chat.History, lastId, () => {
    loadingms && loadingms.destroy()
    nextTick(() => scrollTo(event.target.scrollHeight - scrollPosition))
  }, () => {
    loadingms = ms.loading(
      '加载中...', {
        duration: 0,
      },
    )
  }, () => {
    allmsg && allmsg.destroy()
    allmsg = ms.warning('没有更多了', {
      duration: 1000,
    })
  })
}

const handleLoadMoreMessage = debounce(loadMoreMessage, 300)

async function handleScroll(event: any) {
  const scrollTop = event.target.scrollTop
  if (scrollTop < 50 && (scrollTop < prevScrollTop || prevScrollTop === undefined))
    handleLoadMoreMessage(event)
  prevScrollTop = scrollTop
}

// 可优化部分
// 搜索选项计算，这里使用value作为索引项，所以当出现重复value时渲染异常(多项同时出现选中效果)
// 理想状态下其实应该是key作为索引项,但官方的renderOption会出现问题，所以就需要value反renderLabel实现
const searchOptions = computed(() => {
  if (prompt.value.startsWith('/')) {
    return promptTemplate.value.filter((item: { key: string }) => item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())).map((obj: { value: any }) => {
      return {
        label: obj.value,
        value: obj.value,
      }
    })
  }
  else {
    return []
  }
})

// value反渲染key
const renderOption = (option: { label: string }) => {
  for (const i of promptTemplate.value) {
    if (i.value === option.label)
      return [i.key]
  }
  return []
}

const placeholder = computed(() => {
  if (isMobile.value)
    return t('chat.placeholderMobile')
  return t('chat.placeholder')
})

const buttonDisabled = computed(() => {
  return loading.value || !prompt.value || prompt.value.trim() === ''
})

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value)
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  return classes
})

onMounted(() => {
  firstLoading.value = true
  debounce(() => {
    // 直接刷 极小概率不请求
    chatStore.syncChat({ uuid: Number(uuid) } as Chat.History, undefined, () => {
      firstLoading.value = false
      scrollToBottom()
      if (inputRef.value && !isMobile.value)
        inputRef.value?.focus()
    })
  }, 200)()
})

onUnmounted(() => {
  if (loading.value)
    controller.abort()
})
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <HeaderComponent
      v-if="isMobile"
      :using-context="usingContext"
      :show-prompt="showPrompt"
			:show-draw="showDraw"
      @export="toggleDraw" @toggle-using-context="toggleUsingContext"
      @toggle-show-prompt="showPrompt = true"
    />
    <main class="flex-1 overflow-hidden">
      <div id="scrollRef" ref="scrollRef" class="h-full overflow-hidden overflow-y-auto" @scroll="handleScroll">
        <div
          id="image-wrapper"
          class="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
          :class="[isMobile ? 'p-2' : 'p-4']"
        >
          <NSpin :show="firstLoading">
            <template v-if="!dataSources.length||isFist">
              <div class="flex items-center justify-center mt-4 text-center text-neutral-300">
                <SvgIcon icon="ri:bubble-chart-fill" class="mr-2 text-3xl" />
                <span>1Chat 免费、无限制、免登录、最快的 ChatAI。
									主域:<a style="color: #c18401" href="https://1.1ai.fun" target="_blank">1.1ai.fun </a>
									备用:<a style="color: #c18401" href="https://1.ai1.fun" target="_blank">1.ai1.fun</a>
									临时:<a style="color: #c18401" href="https://chat.littlewheat.com" target="_blank">chat.littlewheat.com </a>
<!--									。-->
<!--									原域名 <span style="color: #c18401">1Chat.cc</span>-->
								</span>

							</div>

<!--								永久免费用于学习和测试,底下输入框输入就能直接用～，点左下角地球图标可关闭搜索模式，关闭后可极速响应-->
<!--								收藏当前页面即可永不迷路，点击左下角捐赠按钮可一直看到最新存活 国内备案不封链接：https://chat.jinshutuan.com/（稳定但有严格内容审查，若要分享到国内或微信分享请用此链接）-->
<!--								最新网站存活（无审查且不稳定勿分享）: https://chat2.aichatos.xyz/-->
<!--								禁止发布、传播任何违法、违规内容，使用本网站，视您接受并同意《免责声明》-->
<!--								服务器昂贵,接口昂贵,但网站免费！！如果你觉得做的好，可以给我买一瓶冰阔落-->
<!--								每人每月捐个三元、服务就能永久免费下去！！-->
<!--              </div>-->
<!--							<div style="color: rgb(50 197 157);margin-bottom: 0px" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--						<span>-->
<!--						 AI绘画：MJ绘画已接入<a style="color: #c18401" :href="mj_1chat" target="_blank"><strong> 点击前往</strong> </a>-->
<!--							&lt;!&ndash;							; 其他：已破解OpenAI海外IOS客户端<a style="color: #c18401" :href="downUrl_1chat" target="_blank"><strong> 点击下载OpenAI国内版</strong> </a>&ndash;&gt;-->
<!--							&lt;!&ndash;					&ndash;&gt;-->
<!--						</span>-->
<!--							</div>-->
							<div style="color: rgb(50 197 157);margin-bottom: 0px" class="flex items-center justify-center mt-4 text-center text-neutral-300">
						<span>
								 AI绘画：MJ最强绘画,<a style="color: #c18401" :href="mj_1chat" target="_blank"><strong> 点击前往</strong> </a>
						 ;App端：<a style="color: #c18401" :href="downUrl_1chat" target="_blank"><strong> 点击下载</strong> </a>
<!--							; 其他：已破解OpenAI海外IOS客户端<a style="color: #c18401" :href="downUrl_1chat" target="_blank"><strong> 点击下载OpenAI国内版</strong> </a>-->
<!--					-->
						</span>
							</div>


<!--							<div style="color: rgb(50 197 157);margin-bottom: 0px" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								服务器昂贵，接口昂贵，但网站免费！！！(说个数据：每日消耗OpenAI余额60刀，早起日常 ε(┬┬﹏┬┬)3 -快哭了)-->
<!--							</div>-->
							<!--                                服务器昂贵，接口昂贵，但网站免费！！！ (说个数据：每日消耗OpenAI余额60刀，早起日常 ε(┬┬﹏┬┬)3 -快哭了)-->
<!--							<div style="margin-bottom: 0px" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--									关注下抖音，网站动态与最新地址 会放抖音，见左侧-->
<!--							</div>-->
<!--							<div style="color: rgb(50 197 157);margin-bottom: 0px" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								服务器昂贵，接口昂贵，但网站免费！！！ 如果你觉得做的好，可以给我买一瓶冰阔落-->
<!--							</div>-->
<!--							<div style="color: rgb(50 197 157);" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								服务器昂贵，接口昂贵，但网站免费！！！如果有帮助到您，可以给我买一瓶冰阔落！！！ 每人每月捐个三元、服务就能永久免费下去！！-->
<!--							</div>-->

<!--							<div style="" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								<span>-->
<!--									主域1: 	<a style="color: #c18401" href="https://1.1ai.fun" target="_blank">1.1ai.fun </a>-->
<!--									主域2：	<a style="color: #c18401" href="https://1.ai1.fun" target="_blank">1.ai1.fun</a>-->
<!--									临域： <a style="color: #c18401" href="https://chat.littlewheat.com" target="_blank">chat.littlewheat.com </a>-->
<!--								</span>-->
<!--							</div>-->
<!--							<div style="color: #c18401" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								<span>-->
<!--									<a style="" href="https://h5leu249nc.feishu.cn/sheets/NDEOst9OMhOq5CtjvavcfFD2n7f" target="_blank">  情况说明 见 【飞书文档】1Chat 域名更换通知 </a>-->
<!--								</span>-->
<!--							</div>-->
<!--							<div style="color: #c18401" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								<span> <a style="" href="https://h5leu249nc.feishu.cn/sheets/NDEOst9OMhOq5CtjvavcfFD2n7f" target="_blank">https://h5leu249nc.feishu.cn/sheets/NDEOst9OMhOq5CtjvavcfFD2n7f </a> </span>-->
<!--							</div>-->
<!--							<div style="color: #c18401" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								<img  style="max-width: 10rem" :src="imageUrl_wxzs" />-->
<!--							</div>-->

<!--							<div style="color: rgb(50 197 157);" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								每人每月捐个三元、服务就能永久免费下去！！ 如果你觉得做的好，可以给我买一瓶冰阔落-->
<!--							</div>-->

<!--							<div style="margin-bottom: 0px" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								<span style="color: rgb(99 165 237)">-->
<!--								服务器昂贵，接口昂贵，但网站免费！！！-->
<!--								</span>-->
<!--							</div>-->
<!--							<div style="margin-bottom: 0px" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								如果你觉得做的好，可以给我买一瓶冰阔落-->
<!--							</div>-->
														<div style=";margin-bottom: 0px" class="flex items-center justify-center mt-4 text-center text-neutral-300">
															服务器昂贵，接口昂贵，但网站免费！！！ 如果你觉得做的好，可以给我买一瓶冰阔落
														</div>

							<div style="color: rgb(50 197 157);" class="flex items-center justify-center mt-4 text-center text-neutral-300">
								每人每月捐个三元、服务就能永久免费下去！！
							</div>
<!--									<div style="color: rgb(50 197 157);" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--											每人每月捐个三元、服务就能永久免费下去！！		<a style="" :href="imageUrl_wxzs" target="_blank">点击->赞助 </a>-->
<!--									</div>-->

											<div style="" class="flex items-center justify-center mt-4 text-center text-neutral-300">
																<img  style="max-width: 14rem" :src="imageUrl_wxzs" />
															</div>
<!--							<div style="" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								<img  style="max-width: 15rem" :src="imageUrl_wxzs" />	<img style="max-width: 15rem" :src="imageUrl_wxzs" />-->
<!--							</div>-->

<!--							<div style="" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--								<img  style="max-width: 10rem" :src="imageUrl_wxzs" />	<img style="max-width: 10rem" :src="imageUrl_wxzs" />-->
<!--							</div>-->


            </template>
            <template v-else>
              <div>
                <Message
                  v-for="(item, index) of dataSources"
                  :key="index"
                  :date-time="item.dateTime"
                  :text="item.text"
                  :inversion="item.inversion"
                  :usage="item && item.usage || undefined"
                  :error="item.error"
                  :loading="item.loading"
                  @regenerate="onRegenerate(index)"
                  @delete="handleDelete(index)"
                />
                <div class="sticky bottom-0 left-0 flex justify-center">
                  <NButton v-if="loading" type="warning" @click="handleStop">
                    <template #icon>
                      <SvgIcon icon="ri:stop-circle-line" />
                    </template>
                    Stop Responding
                  </NButton>
                </div>
              </div>
            </template>
          </NSpin>
        </div>
      </div>
    </main>
    <footer :class="footerClass">
      <div class="w-full max-w-screen-xl m-auto">
        <div class="flex items-center justify-between space-x-2">
          <HoverButton @click="handleClear">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:delete-bin-line" />
            </span>
          </HoverButton>
<!--          <HoverButton v-if="!isMobile" @click="handleExport">-->
<!--            <span class="text-xl text-[#4f555e] dark:text-white">-->
<!--              <SvgIcon icon="ri:download-2-line" />-->
<!--            </span>-->
<!--          </HoverButton>-->
          <HoverButton v-if="!isMobile" @click="showPrompt = true">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <IconPrompt class="w-[20px] m-auto" />
            </span>
          </HoverButton>

          <HoverButton v-if="!isMobile" @click="toggleUsingContext">
            <span class="text-xl" :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }">
							<SvgIcon icon="ri:chat-history-line" />
            </span>

          </HoverButton>
					<HoverButton v-if="!isMobile" @click="toggleDraw">
            <span class="text-xl" :class="{ 'text-[#4b9e5f]': showDraw, 'text-[#c9d1d9b8]': !showDraw }">
							画
            </span>
					</HoverButton>

          <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
            <template #default="{ handleInput, handleBlur, handleFocus }">
              <NInput
                ref="inputRef"
                v-model:value="prompt"

                type="textarea"
                :placeholder="placeholder"
                :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 8 }"
                @input="handleInput"
                @focus="handleFocus"
                @blur="handleBlur"
                @keypress="handleEnter"
              />
            </template>
          </NAutoComplete>
          <NButton type="primary" :disabled="buttonDisabled" @click="handleSubmit">
            <template #icon>
              <span class="dark:text-black">
                <SvgIcon icon="ri:send-plane-fill" />
              </span>
            </template>
          </NButton>
        </div>
      </div>
    </footer>
    <Prompt v-if="showPrompt" v-model:roomId="uuid" v-model:visible="showPrompt" />
	</div>
</template>
