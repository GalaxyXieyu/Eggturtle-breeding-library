export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType?: string;
};

export type PutObjectResult = {
  key: string;
  url: string;
  contentType: string | null;
};

export type GetObjectResult = {
  body: Buffer;
  contentType: string | null;
};

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObject(key: string): Promise<GetObjectResult>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}
