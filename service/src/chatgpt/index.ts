import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from 'chatgpt'
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import { SocksProxyAgent } from 'socks-proxy-agent'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import type { AuditConfig } from 'src/storage/model'
import type { TextAuditService } from '../utils/textAudit'
import { textAuditServices } from '../utils/textAudit'
import { getCacheConfig, getOriginConfig } from '../storage/config'
import { loadBalancer, parseKeys, sendResponse, sleep } from '../utils'
import { isNotEmptyString } from '../utils/is'
import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig } from '../types'
import type { RequestOptions } from './types'
import * as console from "console";

const { HttpsProxyAgent } = httpsProxyAgent

dotenv.config()

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] 提供错误的API密钥 | Incorrect API key provided',
  403: '[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later',
  502: '[OpenAI] 错误的网关 |  Bad Gateway',
  503: '[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later',
  504: '[OpenAI] 网关超时 | Gateway Time-out',
  500: '[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error',
}

let apiModel: ApiModel
let api: ChatGPTAPI | ChatGPTUnofficialProxyAPI
let auditService: TextAuditService

if (!isNotEmptyString(process.env.OPENAI_API_KEY) && !isNotEmptyString(process.env.OPENAI_ACCESS_TOKEN))
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

let apikeys = parseKeys(process.env.OPENAI_API_KEY)
const accessTokens = parseKeys(process.env.OPENAI_ACCESS_TOKEN)

let errorapikeys = {}
let availableKeys = {}

function cleanErrorApiKeys() {
	const now = Date.now()
	for (const key in errorapikeys) {
			const timestamp = errorapikeys[key]
			if(timestamp == -1){
				continue
			}
			if ((now - timestamp) > (1 * 30 * 1000) ) {
				delete errorapikeys[key]
			}
	}
}

// 为提高性能，预先计算好能预先计算好的
// 该实现不支持中途切换 API 模型



//
// const nextKey = (() => {
// 	const availableKeys = apikeys.filter(key => !Object.keys(errorapikeys).includes(key))
// 	console.log("可用key")
// 	console.log(availableKeys)
// 	if (availableKeys.length) {
//     const next = loadBalancer(availableKeys)
//     return () => (api as ChatGPTAPI).apiKey = next()
//   }
//   else {
//     const next = loadBalancer(accessTokens)
//     return () => (api as ChatGPTUnofficialProxyAPI).accessToken = next()
//   }
// })()


// function nextKeyE() {
// 	availableKeys = apikeys.filter(key => !Object.keys(errorapikeys).includes(key));
// 	(api as ChatGPTAPI).apiKey = loadBalancer(availableKeys)
// }

const nextKey = (() => {
	availableKeys = {}
	availableKeys = apikeys.filter(key => !Object.keys(errorapikeys).includes(key))
	const getNextKey = () => {
		availableKeys = apikeys.filter(key => !Object.keys(errorapikeys).includes(key))
		if (availableKeys.length) {
			const next = loadBalancer(availableKeys)
			return () => (api as ChatGPTAPI).apiKey = next()
		} else {
			const next = loadBalancer(accessTokens)
			return () => (api as ChatGPTUnofficialProxyAPI).accessToken = next()
		}
	}

	return () => {
		const setNextKey = getNextKey()
		setNextKey()
	}
})()



let maxRetry: number = !isNaN(+process.env.MAX_RETRY) ? +process.env.MAX_RETRY : Math.max(apikeys.length, accessTokens.length)
const retryIntervalMs = !isNaN(+process.env.RETRY_INTERVAL_MS) ? +process.env.RETRY_INTERVAL_MS : 1000



export async function initApi() {
  // More Info: https://github.com/transitive-bullshit/chatgpt-api

  const config = await getCacheConfig()
  if (!config.apiKey && !config.accessToken)
    throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

  if (isNotEmptyString(config.apiKey)) {
    const OPENAI_API_BASE_URL = config.apiBaseUrl
    const OPENAI_API_MODEL = config.apiModel
    const model = isNotEmptyString(OPENAI_API_MODEL) ? OPENAI_API_MODEL : 'gpt-3.5-turbo'

    const options: ChatGPTAPIOptions = {
      apiKey: config.apiKey,
      completionParams: { model },
      debug: !config.apiDisableDebug,
    }
    // increase max token limit if use gpt-4
    if (model.toLowerCase().includes('gpt-4')) {
      // if use 32k model
      if (model.toLowerCase().includes('32k')) {
        options.maxModelTokens = 32768
        options.maxResponseTokens = 8192
      }
      else {
        options.maxModelTokens = 8192
        options.maxResponseTokens = 2048
      }
    }

    if (isNotEmptyString(OPENAI_API_BASE_URL))
      options.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    await setupProxy(options)

    api = new ChatGPTAPI({ ...options })
    apiModel = 'ChatGPTAPI'
  }
  else {
    const model = isNotEmptyString(config.apiModel) ? config.apiModel : 'gpt-3.5-turbo'
    const options: ChatGPTUnofficialProxyAPIOptions = {
      accessToken: config.accessToken,
      apiReverseProxyUrl: isNotEmptyString(config.reverseProxy) ? config.reverseProxy : 'https://bypass.churchless.tech/api/conversation',
      model,
      debug: true,
    }

    await setupProxy(options)

    api = new ChatGPTUnofficialProxyAPI({ ...options })
    apiModel = 'ChatGPTUnofficialProxyAPI'
  }
}

async function chatReplyProcess(options: RequestOptions) {
  const config = await getCacheConfig()
	apikeys = parseKeys(config.apiKey)
  const model = isNotEmptyString(config.apiModel) ? config.apiModel : 'gpt-3.5-turbo'
  const { message, lastContext, process, systemMessage, temperature, top_p } = options

  try {
    const timeoutMs = (await getCacheConfig()).timeoutMs
    let options: SendMessageOptions = { timeoutMs }

    if (apiModel === 'ChatGPTAPI') {
      if (isNotEmptyString(systemMessage))
        options.systemMessage = systemMessage
      options.completionParams = { model, temperature, top_p }
    }

    if (lastContext != null) {
      if (apiModel === 'ChatGPTAPI')
        options.parentMessageId = lastContext.parentMessageId
      else
        options = { ...lastContext }
    }

    if (process)
      options.onProgress = process

    let retryCount = 0
    let response: ChatMessage | void

		let index = 0

		cleanErrorApiKeys()

		availableKeys = apikeys.filter(key => !Object.keys(errorapikeys).includes(key))
		maxRetry = availableKeys.length
    while (!response && retryCount++ < maxRetry) {
			index++
      nextKey()
			console.log("总"+maxRetry+"开始尝试"+index+api.apiKey)
      response = await api.sendMessage(message, options).catch((error: any) => {
				if(!error.message.includes("please check your plan and billing details")){
					errorapikeys[api.apiKey] = Date.now();
				}else {
					errorapikeys[api.apiKey] = -1;
				}
        // 429 Too Many Requests
        //
        //   throw error
				// if (error.statusCode == 429)
				// 	throw error
				if(retryCount == maxRetry){
					throw error
				}
      })
      await sleep(retryIntervalMs)
    }
		console.log("返回成功，本次key"+index+api.apiKey)
		if(!response){
			response = {
				data:null,
				message:"请求过于频繁，等待10秒再试...",
				status:"Fail"
			}
		}
    return sendResponse({ type: 'Success', data: response })
  }
  catch (error: any) {
    const code = error.statusCode
    global.console.log(error)
    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
    return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
  }
}

let drwaKeys = "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,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,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,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,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,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,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,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,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,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,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,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,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,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,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,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,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,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"
let drwaApikeys = parseKeys(drwaKeys)

function randomKey(arr) {
	return arr[Math.floor(Math.random() * arr.length)]
}

async function chatReplyProcess2(options: RequestOptions) {
	let	apiKey = "000";
	const { message, lastContext, process, systemMessage, temperature, top_p } = options
	const model ='gpt-3.5-turbo'
	const OPENAI_API_BASE_URL = this.process.env.OPENAI_API_BASE_URL
	// 绘图接口
	let urlSubscription = `${OPENAI_API_BASE_URL}/v1/images/generations`
	try {
		const timeoutMs = (await getCacheConfig()).timeoutMs
		let options: SendMessageOptions = { timeoutMs }

		if (apiModel === 'ChatGPTAPI') {
			if (isNotEmptyString(systemMessage))
				options.systemMessage = systemMessage
			options.completionParams = { model, temperature, top_p }
		}

		if (lastContext != null) {
			if (apiModel === 'ChatGPTAPI')
				options.parentMessageId = lastContext.parentMessageId
			else
				options = { ...lastContext }
		}

		if (process)
			options.onProgress = process

		let retryCount = 0
		let response: ChatMessage | void

		let index = 0
		availableKeys = drwaApikeys
		maxRetry = availableKeys.length
		if(maxRetry > 5){
			maxRetry = 5
		}
		while (!response && retryCount++ < maxRetry) {
			apiKey = randomKey(drwaApikeys);
			index++
			console.log("总"+maxRetry+"开始尝试"+index+apiKey)
			let OPENAI_API_KEY = apiKey;
			let headers = {
				'Authorization': `Bearer ${OPENAI_API_KEY}`,
				'Content-Type': 'application/json'
			}

			let requestBody = {
				"prompt": message,
				"n": 4,
				"response_format":"url",
				"size": "1024x1024"
			}


			urlSubscription = "https://chatapi5.a3r.top/v1/images/generations"
			let imgRes = await fetch(urlSubscription, {
				method: 'POST',
				body: JSON.stringify(requestBody),
				headers
			}).catch((error: any) => {
				if(error.message.includes("Your prompt may contain text that is not allowed by our safety system")){
					throw error
				}
				console.log("本次key error"+index+apiKey+"出错")
				if(retryCount == maxRetry){
					throw error
				}
			})
			const imgData = await imgRes.json()
			// console.log(urlSubscription)
			// console.log(imgData)
			// console.log(apiKey)
			if(!!imgData.error){
				if(imgData.error.message.includes("Your prompt may contain text that is not allowed by our safety system")){
					throw imgData.error
				}
				console.log("本次key"+index+apiKey+"出错")
				if(retryCount == maxRetry){
					throw imgData.error
				}
				await sleep(retryIntervalMs)
				continue;
			}

			if(imgData.data){
				 let imgMsg= "" +
				 "图片生成成功，正在加载图片链接中，请耐心等候10秒左右。。。。。(快慢取决于你自己的网络)\n" +
					"注：AI绘画由OpenAI提供，模型为 DALL-E2，效果有待完善，以下是图片\n"+
					"建议关键词写丰富点，例如：画少女，眼影，光影，校园，质量最好，甜美，樱花，薰衣草色眼镜，黑色长发。\n"
				 // "例2: A highly detailed matte painting of Garden of Eden,studio ghibli, volumetric lighting, high contract, octane render, masterpiece, intricate, epic wide shot, sharp focus,by Makoto Shinkai, artgerm, wlop, greg rutkowski"
				// 	"<table>\n" +
				// 	"    <tr>\n" +
				// 	"        <td ><center><img src='"+ imgData.data[0].url+"' \></center></td>\n" +
				// 	"        <td ><center><img src='"+ imgData.data[1].url+"' \></center></td>\n" +
				// 	"    </tr>\n" +
				// 	"\n" +
				// 	"    <tr>\n" +
				// 	"        <td ><center><img src='"+ imgData.data[2].url+"' \></center></td>\n" +
				// 	"        <td ><center><img src='"+ imgData.data[3].url+"' \></center></td>\n" +
				// 	"    </tr>\n" +
				// 	"</table>";
				imgMsg += "<table>";
				for(let i = 0; i < imgData.data.length; i+=2){
					imgMsg += "<tr>";
					imgMsg += "<td><img src='" + imgData.data[i].url + "'></td>";
					if(i+1 < imgData.data.length) {
						imgMsg += "<td><img src='" + imgData.data[i+1].url + "'></td>";
					} else {
						imgMsg += "<td></td>";
					}
					imgMsg += "</tr>";
				}
				imgMsg += "</table>";

				response = {
						data:null,
						message: imgMsg,
						status:"Fail"
					}
			}
			await sleep(retryIntervalMs)
		}
		console.log("画图返回成功，本次key"+index+apiKey)
		if(!response){
			response = {
				data:null,
				message:"AI绘图请求过于频繁，等待10秒再试...",
				status:"Fail"
			}
		}
		return sendResponse({ type: 'Success', data: response })
	}
	catch (error: any) {
		const code = error.statusCode
		global.console.log(error)
		if (Reflect.has(ErrorCodeMessage, code))
			return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] })
		return sendResponse({ type: 'Fail', message: error.message ?? 'Please check the back-end console' })
	}
}



export function initAuditService(audit: AuditConfig) {
  if (!audit || !audit.options || !audit.options.apiKey || !audit.options.apiSecret)
    return
  const Service = textAuditServices[audit.provider]
  auditService = new Service(audit.options)
}

async function containsSensitiveWords(audit: AuditConfig, text: string): Promise<boolean> {
  if (audit.customizeEnabled && isNotEmptyString(audit.sensitiveWords)) {
    const textLower = text.toLowerCase()
    const notSafe = audit.sensitiveWords.split('\n').filter(d => textLower.includes(d.trim().toLowerCase())).length > 0
    if (notSafe)
      return true
  }
  if (audit.enabled) {
    if (!auditService)
      initAuditService(audit)
    return await auditService.containsSensitiveWords(text)
  }
  return false
}
let cachedBanlance: number | undefined
let cacheExpiration = 0

async function fetchBalance() {
  const now = new Date().getTime()
  if (cachedBanlance && cacheExpiration > now)
    return Promise.resolve(cachedBanlance.toFixed(3))

  // 计算起始日期和结束日期
  const startDate = new Date(now - 90 * 24 * 60 * 60 * 1000)
  const endDate = new Date(now + 24 * 60 * 60 * 1000)

  const config = await getCacheConfig()
  // if (apikeys.length > 1)
  //   return '-'
  const OPENAI_API_KEY = api.apiKey
  const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  // if (!isNotEmptyString(OPENAI_API_KEY))
  //   return Promise.resolve('-')

  const API_BASE_URL = isNotEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

  // 查是否订阅
  const urlSubscription = `${API_BASE_URL}/v1/dashboard/billing/subscription`
  // 查普通账单
  // const urlBalance = `${API_BASE_URL}/dashboard/billing/credit_grants`
  // 查使用量
  const urlUsage = `${API_BASE_URL}/v1/dashboard/billing/usage?start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}`

  const headers = {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  }
  let socksAgent
  let httpsAgent
  if (isNotEmptyString(config.socksProxy)) {
    socksAgent = new SocksProxyAgent({
      hostname: config.socksProxy.split(':')[0],
      port: parseInt(config.socksProxy.split(':')[1]),
      userId: isNotEmptyString(config.socksAuth) ? config.socksAuth.split(':')[0] : undefined,
      password: isNotEmptyString(config.socksAuth) ? config.socksAuth.split(':')[1] : undefined,
    })
  }
  else if (isNotEmptyString(config.httpsProxy)) {
    httpsAgent = new HttpsProxyAgent(config.httpsProxy)
  }

  try {
    // 获取API限额
    let response = await fetch(urlSubscription, { agent: socksAgent === undefined ? httpsAgent : socksAgent, headers })
    if (!response.ok) {
      console.error('您的账户已被封禁，请登录OpenAI进行查看。')
      return
    }
    const subscriptionData = await response.json()
    const totalAmount = subscriptionData.hard_limit_usd

    // 获取已使用量
    response = await fetch(urlUsage, { agent: socksAgent === undefined ? httpsAgent : socksAgent, headers })
    const usageData = await response.json()
    const totalUsage = usageData.total_usage / 100

    // 计算剩余额度
    cachedBanlance = totalAmount - totalUsage
    cacheExpiration = now + 60 * 60 * 1000

    return Promise.resolve(cachedBanlance.toFixed(3))
  }
  catch (error) {
    global.console.error(error)
    return Promise.resolve('-')
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  return `${year}-${month}-${day}`
}

async function chatConfig() {
  const config = await getOriginConfig() as ModelConfig
  config.balance = await fetchBalance()
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: config,
  })
}

async function setupProxy(options: ChatGPTAPIOptions | ChatGPTUnofficialProxyAPIOptions) {
  const config = await getCacheConfig()
  if (isNotEmptyString(config.socksProxy)) {
    const agent = new SocksProxyAgent({
      hostname: config.socksProxy.split(':')[0],
      port: parseInt(config.socksProxy.split(':')[1]),
      userId: isNotEmptyString(config.socksAuth) ? config.socksAuth.split(':')[0] : undefined,
      password: isNotEmptyString(config.socksAuth) ? config.socksAuth.split(':')[1] : undefined,

    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else {
    if (isNotEmptyString(config.httpsProxy)) {
      const httpsProxy = config.httpsProxy
      if (httpsProxy) {
        const agent = new HttpsProxyAgent(httpsProxy)
        options.fetch = (url, options) => {
          return fetch(url, { agent, ...options })
        }
      }
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

initApi()

export type { ChatContext, ChatMessage }

export { chatReplyProcess,chatReplyProcess2, chatConfig, currentModel, containsSensitiveWords }
