import {getBucket, getCurrencyFile} from "./env.js";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
const EXPIRES = 24 * 3600 + 5;

export function s3Updater(
    {
        bucket = getBucket(),
        file = getCurrencyFile(),
        logger = console
    } = {}
) {
    const client = new S3Client();
    return function (newContents) {
        logger.info(`Updating "s3://${bucket}/${file}"..."`)
        return client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: file,
            Body: newContents,
            Expires: new Date(new Date().getTime() + (EXPIRES * 1000)),
        }))
    }
}