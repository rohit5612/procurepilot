import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'local';
const LOCAL_DIR = process.env.STORAGE_LOCAL_DIR || path.resolve(process.cwd(), 'storage');

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

class LocalStorageAdapter {
  async save(fileBuffer, key, contentType = 'application/octet-stream') {
    const fullPath = path.resolve(LOCAL_DIR, key);
    ensureDirSync(path.dirname(fullPath));
    await fs.promises.writeFile(fullPath, fileBuffer);
    return { key, url: `/files/${encodeURIComponent(key)}`, contentType };
  }

  async getStream(key) {
    const fullPath = path.resolve(LOCAL_DIR, key);
    return fs.createReadStream(fullPath);
  }

  async exists(key) {
    try {
      await fs.promises.access(path.resolve(LOCAL_DIR, key), fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key) {
    const fullPath = path.resolve(LOCAL_DIR, key);
    try {
      await fs.promises.unlink(fullPath);
      return true;
    } catch (err) {
      if (err?.code === 'ENOENT') return false;
      throw err;
    }
  }
}

class S3StorageAdapter {
  constructor() {
    this.bucket = process.env.S3_BUCKET;
    this.region = process.env.S3_REGION || process.env.AWS_REGION || 'ap-south-1';
    this.client = new S3Client({ region: this.region });
    this.kmsKeyId = process.env.S3_KMS_KEY_ID || null;
  }

  ensureConfigured() {
    if (!this.bucket) {
      throw new Error('S3 storage not configured: S3_BUCKET is not set');
    }
  }

  async save(fileBuffer, key, contentType = 'application/octet-stream') {
    this.ensureConfigured();
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType || 'application/octet-stream'
    };
    if (this.kmsKeyId) {
      params.ServerSideEncryption = 'aws:kms';
      params.SSEKMSKeyId = this.kmsKeyId;
    }
    await this.client.send(new PutObjectCommand(params));
    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}`;
    return { key, url, contentType };
  }

  async getStream(key) {
    this.ensureConfigured();
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body;
  }

  async exists(key) {
    this.ensureConfigured();
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
        return false;
      }
      throw err;
    }
  }

  async delete(key) {
    this.ensureConfigured();
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return true;
  }
}

const adapter = STORAGE_DRIVER === 's3' ? new S3StorageAdapter() : new LocalStorageAdapter();

export default {
  save: (...args) => adapter.save(...args),
  getStream: (...args) => adapter.getStream(...args),
  exists: (...args) => adapter.exists(...args),
  delete: (...args) => adapter.delete(...args),
  driver: STORAGE_DRIVER
};
