import jwt from 'jsonwebtoken'
import { getCacheConfig } from '../storage/config'
import { getUserById } from '../storage/mongo'
import { Status } from '../storage/model'
import * as console from "console";

const auth = async (req, res, next) => {
	const config = await getCacheConfig()
	if (req.header('Authorization')) {
		try {
			const token = req.header('Authorization').replace('Bearer ', '')
			const info = jwt.verify(token, config.siteConfig.loginSalt.trim())
			req.headers.userId = info.userId
			const user = await getUserById(info.userId)
			if (user == null || user.status !== Status.Normal)
				throw new Error('用户不存在 | User does not exist.')
			else
				next()
		}
		catch (error) {
			console.log(error)
			res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
		}
	}else {
		// fake userid
		// req.headers.userId = '6406d8c50aedd633885fa16f'
		//未登录情况下是否放行
		if(!config.siteConfig.loginEnabled){
		//	console.log("t1")
			next()
		}else {
			res.send({ status: 'Unauthorized', message: '登录账号，开启ChatGPT之旅！', data: null })
		}
		//next()
	}
}

export { auth }
