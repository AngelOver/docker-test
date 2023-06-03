import { ss } from '@/utils/storage'
import INITIAL_PROMPT_LIST from '../../../assets/prompts.json'


const LOCAL_NAME = 'promptStore'

export type PromptList = []

const promptRecommendList: PromptList  = INITIAL_PROMPT_LIST.data.promptList as PromptList


export interface PromptStore {
  promptList: PromptList
}

export function getLocalPromptList(): PromptStore {
  const promptStore: PromptStore | undefined = ss.get(LOCAL_NAME)
	if (!promptStore) {
		ss.set(LOCAL_NAME, { promptList: promptRecommendList })
		return { promptList: promptRecommendList }
	}
	return promptStore
}

export function setLocalPromptList(promptStore: PromptStore): void {
  ss.set(LOCAL_NAME, promptStore)
}
