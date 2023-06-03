<script setup lang='ts'>
import type { CSSProperties } from 'vue'
import { computed, ref, watch } from 'vue'
import { NButton, NLayoutSider } from 'naive-ui'
import List from './List.vue'
import Footer from './Footer.vue'
import { useAppStore, useAuthStore, useChatStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { PromptStore } from '@/components/common'

const appStore = useAppStore()
const authStore = useAuthStore()
const chatStore = useChatStore()

const { isMobile } = useBasicLayout()
const show = ref(false)

let imageUrl_dy = 'https://qiniuchat.littlewheat.com/other/dy.jpg?t=' + Date.now()
let imageUrl = 'https://qiniuchat.littlewheat.com/other/chatgpt_wx.jpg?t=' + Date.now()
let imageUrl_wxzs = 'https://qiniuchat.littlewheat.com/other/wxzs.jpg?t=' + Date.now()
let mj_1chat = 'https://mj.c3r.ink'


let downUrl_1chat = 'https://qiniuchat.littlewheat.com/other/app/android/1chat.apk?t=' + Date.now()
let downUrl_chatcn = 'https://qiniuchat.littlewheat.com/other/app/android/ChatGPT%E5%9B%BD%E5%86%85%E7%89%88.apk?t=' + Date.now()

const collapsed = computed(() => appStore.siderCollapsed)

async function handleAdd() {
  await chatStore.addHistory({ title: 'New Chat', uuid: Date.now(), isEdit: false })
  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

function handleUpdateCollapsed() {
  appStore.setSiderCollapsed(!collapsed.value)
}

const getMobileClass = computed<CSSProperties>(() => {
  if (isMobile.value) {
    return {
      position: 'fixed',
      zIndex: 50,
    }
  }
  return {}
})

const mobileSafeArea = computed(() => {
  if (isMobile.value) {
    return {
      paddingBottom: 'env(safe-area-inset-bottom)',
    }
  }
  return {}
})

watch(
  isMobile,
  (val) => {
    appStore.setSiderCollapsed(val)
  },
  {
    immediate: true,
    flush: 'post',
  },
)
</script>

<template>

  <NLayoutSider
    :collapsed="collapsed"
    :collapsed-width="0"
    :width="260"
    :show-trigger="isMobile ? false : 'arrow-circle'"
    collapse-mode="transform"
    position="absolute"
    bordered
    :style="getMobileClass"
    @update-collapsed="handleUpdateCollapsed"
  >
    <div class="flex flex-col h-full" :style="mobileSafeArea">
      <main class="flex flex-col flex-1 min-h-0">
        <div class="p-4">
          <NButton dashed block  @click="handleAdd">
            {{ $t('chat.newChatButton') }}
          </NButton>
        </div>
        <div class="flex-1 min-h-0 pb-4 overflow-hidden">
          <List />
        </div>
				<div class="p-4 " style="padding-top: 0px;padding-bottom: 10px;">

<!--					<h6 style="font-size: 14.5px">-->
<!--						<strong><a href="https://1chat.cc" target="_blank" >1Chat.cc 免费、无限制、免登最快 </a> </strong>-->
<!--					</h6>-->
				<!-- 	<h6 style="margin-bottom: 0px;color: #c18401;font-size: x-small">
						永久域名：<a href="https://1chat.cc" target="_blank"> https://1chat.cc  </a>
					</h6> -->

<!--					<h6 style="margin-bottom:5rem;;font-size: 12px;opacity: 0.5;text-align: right">-->
<!--						“最快”：100字返回5秒-->
<!--					</h6>-->
<!--					<h6 style="margin-bottom:5rem;color: #c18401;font-size:  xx-small">-->
<!--						是快是慢，看你们运气 ╮(￣▽￣)╭ 成本4:1-->
<!--					</h6>-->






					<!--					<h6 style="margin-bottom: 20px;font-size:  xx-small">-->
<!--						<h6 style="display: flex;justify-content: center;align-items: center;">-->
<!--							<img style="max-width: 50% " :src="imageUrl_wxzs" />-->
<!--						</h6>-->
<!--					</h6>-->
<!--										<h6 style=";color: #c18401;font-size: 12.5px">-->
<!--											<a :href="mj_1chat" target="_blank"><strong>2023.5 新增AI绘画模式</strong> </a>-->
<!--										</h6>-->
					<h6 style=";color: #c18401;font-size: 12.5px">
						<a :href="mj_1chat" target="_blank"><strong>2023.6 新增MJ最强AI绘画 点击前往</strong> </a>
					</h6>
										<h6 style=";color: #c18401;font-size: 12.5px">
											<a :href="downUrl_1chat" target="_blank"><strong> App端（仅安卓）点击下载</strong> </a>
										</h6>
<!--										<h6 style="margin-bottom:2.5rem;color: #c18401;font-size: 12.5px">-->
<!--											<a :href="downUrl_chatcn" target="_blank"><strong> 新增OpenAI国内破解版APP，点击下载</strong> </a>-->
<!--										</h6>-->

<!--					<h6 style="margin-bottom: 0px;color: #c18401;">-->
<!--						1Chat被DNS攻击，旧域名已失效-->
<!--					</h6>-->
					<h6 style="margin-bottom: 3rem;color: #c18401;font-size: 10px">
						<a style="color: #f2cc60;" href="https://h5leu249nc.feishu.cn/sheets/NDEOst9OMhOq5CtjvavcfFD2n7f"
							 target="_blank">
							新域名见飞书文档（可收藏）
						</a>
					</h6>
<!--					<h6 style="margin-bottom: 0px;color: #c18401;">-->
<!--						主站域名1：<a href=" https://	1.1ai.fun" target="_blank">1.1ai.fun-->
<!--					</a>-->
<!--					</h6>-->
<!--					<h6 style="margin-bottom: 0px;color: #c18401;">-->
<!--						主站域名2：<a href=" https://1.ai1.fun" target="_blank">1.ai1.fun-->
<!--					</a>-->
<!--					</h6>-->
<!--						<h6 style="margin-bottom: 0px;color: #c18401;">-->
<!--							业务域名（随时换）：<a href=" https://1chat.c3r.ink" target="_blank">1chat.c3r.ink-->
<!--						</a>-->
<!--					</h6>-->
<!--						<h6 style="margin-bottom: 0px;color: #c18401;">-->
<!--							临时域名：<a href=" https://chat.littlewheat.com" target="_blank">chat.littlewheat.com-->
<!--						</a>-->
<!--					</h6>-->


<!--						<h6 style="margin-bottom:5rem;color: #c18401;font-size: 12.5px">-->
<!--							<a :href="imageUrl_wxzs" target="_blank"><strong>2023.5 新增AI绘画模式</strong> </a>-->
<!--						</h6>-->




<!--										<h6 style="margin-bottom:5rem;color: #c18401;font-size: 12.5px">-->
<!--											<a :href="imageUrl_wxzs" target="_blank"><strong>&#45;&#45; 待开发 Midjourney 绘画接入中 </strong> </a>-->
<!--										</h6>-->
<!--					<h6 style="color: #c18401;font-size: 12.5px">-->
<!--						<a :href="imageUrl_wxzs" target="_blank"><strong>服务器昂贵，接口昂贵，但网站免费！！</strong> </a>-->
<!--					</h6>-->
<!--					<h6 style="color: rgb(50 197 157);font-size: 12px">-->
<!--						<a :href="imageUrl_wxzs" target="_blank">每人每月捐个三元、服务就能永久免费下去 </a>-->
<!--					</h6>-->
<!--												<div style="" class="flex items-center justify-center mt-4 text-center text-neutral-300">-->
<!--													<img  style="max-width: 5rem" :src="imageUrl_wxzs" />-->
<!--												</div>-->
<!--					<h6 style="opacity: 0.7;margin-bottom:3rem;text-align: right">-->
<!--						<a style="padding-left: 50%;" :href="imageUrl_wxzs" target="_blank">点击->赞助 </a>-->
<!--					</h6>-->

<!--					<h6 style="color: rgb(50 197 157);font-size: xx-small">-->
<!--						注:如果你懂技术,有能力,有apiKey,可前往-->
<!--					</h6>-->
<!--					<h6 style="color: rgb(50 197 157);font-size:  xx-small">-->
<!--						工具站 key.1chat.cc-->
<!--					</h6>-->
<!--					<h6 style="margin-bottom: 10px;color: #c18401;font-size: xx-small">-->
<!--						全程高速流量，本站免费提供加速服务（本站3千/月专线）,全程响应速度100字5秒-->
<!--					</h6>-->
<!--					<h6 style="margin-bottom: 10px;color: rgb(50 197 157);font-size: xx-small">-->
<!--						没有key，点击购买 “账号加apiKey” 9.9-->
<!--					</h6>-->

				</div>
				<div class="p-4 " style="padding-top: 0">

				</div>
				<div class="p-4 " style="padding-top: 0;">
					<dev class="flex items-center justify-between  " style="padding-bottom: 0.3rem" >
						<div class="flex-1 flex-shrink-0 overflow-hidden">
							<p style="font-size: 12.5px;color: rgb(99 165 237)" >
								<a href="https://1.ai1.fun" target="_blank">备用域名：1.ai1.fun </a>
							</p>
							<p style="color: #c18401" >
								不加群->已走丢
							</p>
							<p>
								v群：---------->
							</p>
							<p>
								q群：791303042
							</p>
						</div>
						<div class="flex-1 flex-shrink-0 overflow-hidden " >
<!--							<img   :src=" 'https://qiniuchat.littlewheat.com/other/chatgpt_wx.jpg?t='+{{Date.now()}} ">-->
							<img  style="max-width: 95%; margin-left: 5%;" :src="imageUrl" />
						</div>
					</dev>

<!--								<div class="p-4 " style="padding-top: 0;">-->
<!--									<dev class="flex items-center justify-between  " style="padding-bottom: 0.3rem" >-->
<!--										<div class="flex-1 flex-shrink-0 overflow-hidden">-->
<!--											<p style="font-size: 12.5px;color: rgb(99 165 237)" >-->
<!--												<a href="https://1chat.cc" target="_blank">永久域名：1Chat.cc </a>-->
<!--											</p>-->
<!--											<p style="color: #c18401" >-->
<!--												抖音：&#45;&#45;&ndash;&gt;-->
<!--											</p>-->
<!--											<p>-->
<!--												<a :href="imageUrl_wxzs" target="_blank">v群：点击加群  </a>-->
<!--											</p>-->
<!--											<p>-->
<!--												q群：791303042-->
<!--											</p>-->
<!--										</div>-->
<!--										<div class="flex-1 flex-shrink-0 overflow-hidden " >-->
<!--				&lt;!&ndash;							<img   :src=" 'https://qiniuchat.littlewheat.com/other/chatgpt_wx.jpg?t='+{{Date.now()}} ">&ndash;&gt;-->
<!--											<img  style="max-width: 100%; margin-left: 0;" :src="imageUrl_dy" />-->
<!--										</div>-->
<!--									</dev>-->



<!--									<h6 style="color:rgb(99 165 237);">-->
<!--										<div class="flex-1 flex-shrink-0 overflow-hidden " >-->
<!--											&lt;!&ndash;							<img   :src=" 'https://qiniuchat.littlewheat.com/other/chatgpt_wx.jpg?t='+{{Date.now()}} ">&ndash;&gt;-->
<!--											<img  style="max-width: 70%; margin-left: 15%;" :src="imageUrl" />-->
<!--										</div>-->
<!--									</h6>-->
<!--									<h6 style="color:#c18401;">-->
<!--									<a style="" :href="imageUrl" target="_blank">v群 不加群的都走丢了 </a>-->
<!--									</h6>-->
<!--				<h6 style="">-->
<!--					<a  style="color:rgb(99 165 237);" href="https://fk.a3e.top?code=YT0xJmI9NQ%3D%3D" target="_blank"> 批发请点击-> 5刀、120刀账号下单 </a>-->
<!--					</h6>-->
<!--				<h6 style="font-size: x-small">-->
<!--							<a style="color: #c18401" href="https://fk.a3e.top?code=YT00JmI9Mw%3D%3D" target="_blank">	研报：GPT专题行业研报与投资趋势6.8元  </a>-->
<!--					</h6>-->

<!--					<h6 style="font-size: 12px">-->
<!--						<a style=";opacity: 0.7;" href="https://fk.a3e.top?code=YT0xJmI9Nw%3D%3D" target="_blank">	外链：ChatGPT余额120美元账号 29元  </a>-->
<!--					</h6>-->
					<!-- 	<h6 style="font-size: 12px">
						<a style="color: #c18401;opacity: 0.5;" href="https://fk.a3e.top?code=YT0xJmI9Nw%3D%3D" target="_blank">	外链：ChatGPT余额120美元账号 29元  </a>
					</h6> -->
					<h6 >
<!--						<a style="color:rgb(99 165 237);font-size: 12px" href="https://fk.a3e.top?code=YT0xJmI9Nw%3D%3D" target="_blank">外链：OpenAI官方120刀账号 点击购买   </a>-->
						<a style="color:rgb(99 165 237)" href="https://fk.a3e.top?code=YT0xJmI9MTA%3D" target="_blank">外链：美区 AppStore账号 点击购买   </a>
					</h6>

<!--									<h6 >-->
<!--												<a style="color:rgb(99 165 237)" href="https://fk.a3e.top?code=YT0xJmI9OQ%3D%3D" target="_blank">外链：滴滴优惠券2张（20元无门槛+5折） 8.8元 点击购买 </a>-->
<!--										</h6>-->

					<h6 style="color: rgb(50 197 157);font-size: 13.5px">
						<a href="https://fk.a3e.top?code=YT0xJmI9Mg%3D%3D" target="_blank">外链：ChatGPT独享账号含5刀 9.9元  </a>
					</h6>
<!--					<NButton block @click="show = true">-->
<!--						OpenAI国内版下载-->
<!--					</NButton>-->
<!--					<NButton block @click="show = true">-->
<!--						本站客户端下载-->
<!--					</NButton>-->

					<NButton block @click="show = true">
						{{ $t('store.siderButton') }}
					</NButton>
				</div>
      </main>
      <Footer />
    </div>
  </NLayoutSider>
  <template v-if="isMobile">
    <div v-show="!collapsed" class="fixed inset-0 z-40 bg-black/40" @click="handleUpdateCollapsed" />
  </template>
  <PromptStore v-model:visible="show" />
</template>
