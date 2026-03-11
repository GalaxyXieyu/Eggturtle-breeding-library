import type {
  CreateProductEventRequest,
  CreateProductRequest,
  UpdateProductEventRequest,
} from '@eggturtle/shared';

export type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type ProductImageContentResult =
  | {
      content: Buffer;
      contentType: string | null;
    }
  | {
      redirectUrl: string;
      contentType: string | null;
    };

export type UpdateProductInput = Partial<CreateProductRequest>;

export type CreateMatingRecordInput = {
  femaleProductId: string;
  maleProductId: string;
  eventDate: string;
  note?: string | null;
};

export type CreateEggRecordInput = {
  femaleProductId: string;
  eventDate: string;
  eggCount?: number | null;
  note?: string | null;
};

export type CreateProductEventInput = CreateProductEventRequest;

export type UpdateProductEventInput = UpdateProductEventRequest;
