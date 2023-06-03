declare let _hmt: any[];

interface BaiduAnalytics {
	push: (...args: any[]) => void;
}

export function useBaiduAnalytics(): BaiduAnalytics {
	const push = (...args: any[]) => {
		if (typeof _hmt !== 'undefined') {
			_hmt.push(args);
		}
	};

	return {
		push,
	};
}
