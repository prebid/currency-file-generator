export function retry(
    fn, {
        delays = [3, 10],
        logger = console,
        delay = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
    } = {},
) {
    return async function () {
        let i = 0;
        while (true) {
            try {
                return await fn.apply(this, arguments);
            } catch (e) {
                if (i < delays.length) {
                    logger.warn('Error, retrying..', e)
                    await delay(delays[i])
                    i++;
                } else {
                    logger.error(`Maximum number of retries exceeded`, e);
                    throw e;
                }
            }
        }
    }
}

