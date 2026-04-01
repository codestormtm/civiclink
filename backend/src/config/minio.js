const Minio = require("minio");
const env = require("./env");

const minioClient = new Minio.Client({
  endPoint: env.minio.endPoint,
  port: env.minio.port,
  useSSL: env.minio.useSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

const minioPublicClient = new Minio.Client({
  endPoint: env.minio.publicEndPoint,
  port: env.minio.publicPort,
  useSSL: env.minio.publicUseSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

const bucketName = env.minio.bucket;

async function ensureBucketExists() {
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName);
  }
}

module.exports = { minioClient, minioPublicClient, bucketName, ensureBucketExists };
