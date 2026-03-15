import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  publicSharePresentationSchema,
  sharePresentationOverrideSchema,
  tenantSharePresentationSchema,
  tenantShareAvatarPresetSchema,
  type PublicSharePresentation,
  type SharePresentationOverride,
  type TenantSharePresentation,
} from '@eggturtle/shared';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { PrismaService } from '../prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage.constants';
import type { StorageProvider } from '../storage/storage.provider';
import { BrandingService } from '../branding/branding.service';

type UploadedBinaryFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type UploadedSharePresentationAsset = {
  key: string;
  url: string;
  contentType: string | null;
  sizeBytes: string;
};

const DEFAULT_BRAND_PRIMARY = '#FFD400';
const DEFAULT_BRAND_SECONDARY = '#1f2937';
const DEFAULT_HERO_IMAGES = ['/images/mg_04.jpg'];
const DEFAULT_WECHAT_BLOCK_VISIBLE = false;

@Injectable()
export class TenantSharePresentationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brandingService: BrandingService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider,
  ) {}

  async getTenantTemplate(tenantId: string): Promise<TenantSharePresentation> {
    const config = await this.prisma.tenantSharePresentationConfig.findUnique({
      where: {
        tenantId,
      },
    });

    if (!config) {
      return this.emptyTemplate();
    }

    return {
      feedTitle: this.normalizeNullableShortText(config.feedTitle),
      feedSubtitle: this.normalizeNullableText(config.feedSubtitle),
      avatarPreset: this.normalizeAvatarPreset(config.avatarPreset),
      brandPrimary: this.normalizeColorToken(config.brandPrimary),
      brandSecondary: this.normalizeColorToken(config.brandSecondary),
      heroImages: this.normalizeHeroImages(config.heroImages),
      showWechatBlock: config.showWechatBlock,
      wechatQrImageUrl: this.normalizeNullableAssetUrl(config.wechatQrImageUrl),
      wechatId: this.normalizeNullableWechatId(config.wechatId),
    };
  }

  async upsertTenantTemplate(
    tenantId: string,
    presentation: TenantSharePresentation,
  ): Promise<TenantSharePresentation> {
    const normalized = tenantSharePresentationSchema.parse(presentation);

    const config = await this.prisma.tenantSharePresentationConfig.upsert({
      where: {
        tenantId,
      },
      create: {
        tenantId,
        feedTitle: this.normalizeNullableShortText(normalized.feedTitle),
        feedSubtitle: this.normalizeNullableText(normalized.feedSubtitle),
        avatarPreset: this.normalizeAvatarPreset(normalized.avatarPreset),
        brandPrimary: this.normalizeColorToken(normalized.brandPrimary),
        brandSecondary: this.normalizeColorToken(normalized.brandSecondary),
        heroImages: this.toHeroImagesJson(normalized.heroImages),
        showWechatBlock: normalized.showWechatBlock,
        wechatQrImageUrl: this.normalizeNullableAssetUrl(normalized.wechatQrImageUrl),
        wechatId: this.normalizeNullableWechatId(normalized.wechatId),
      },
      update: {
        feedTitle: this.normalizeNullableShortText(normalized.feedTitle),
        feedSubtitle: this.normalizeNullableText(normalized.feedSubtitle),
        avatarPreset: this.normalizeAvatarPreset(normalized.avatarPreset),
        brandPrimary: this.normalizeColorToken(normalized.brandPrimary),
        brandSecondary: this.normalizeColorToken(normalized.brandSecondary),
        heroImages: this.toHeroImagesJson(normalized.heroImages),
        showWechatBlock: normalized.showWechatBlock,
        wechatQrImageUrl: this.normalizeNullableAssetUrl(normalized.wechatQrImageUrl),
        wechatId: this.normalizeNullableWechatId(normalized.wechatId),
      },
    });

    return {
      feedTitle: this.normalizeNullableShortText(config.feedTitle),
      feedSubtitle: this.normalizeNullableText(config.feedSubtitle),
      avatarPreset: this.normalizeAvatarPreset(config.avatarPreset),
      brandPrimary: this.normalizeColorToken(config.brandPrimary),
      brandSecondary: this.normalizeColorToken(config.brandSecondary),
      heroImages: this.normalizeHeroImages(config.heroImages),
      showWechatBlock: config.showWechatBlock,
      wechatQrImageUrl: this.normalizeNullableAssetUrl(config.wechatQrImageUrl),
      wechatId: this.normalizeNullableWechatId(config.wechatId),
    };
  }

  async uploadImage(
    tenantId: string,
    actorUserId: string,
    file: UploadedBinaryFile,
  ): Promise<UploadedSharePresentationAsset> {
    const contentType = file.mimetype?.trim() || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      throw new BadRequestException('Only image files are supported.');
    }

    const extension = this.resolveImageExtension(file.originalname, contentType);
    const key = `${tenantId}/tenant-share-presentation/${Date.now()}-${randomUUID()}${extension}`;

    const uploadResult = await this.storageProvider.putObject({
      key,
      body: file.buffer,
      contentType,
      metadata: {
        tenantId,
        uploadedBy: actorUserId,
        source: 'tenant-share-presentation.upload',
      },
    });

    const url = uploadResult.url.startsWith('s3://')
      ? `/tenant-share-presentation/assets?key=${encodeURIComponent(uploadResult.key)}`
      : uploadResult.url;

    return {
      key: uploadResult.key,
      url,
      contentType: uploadResult.contentType,
      sizeBytes: String(file.buffer.length),
    };
  }

  async resolvePublicPresentation(input: {
    tenantId: string;
    tenantName: string;
    actorUserId: string;
    overrideRaw: Prisma.JsonValue | null;
  }): Promise<PublicSharePresentation> {
    const template = await this.getTenantTemplate(input.tenantId);
    const override = this.parseOverride(input.overrideRaw);
    const defaultBranding = await this.brandingService.resolveTenantPublicCopy({
      tenantId: input.tenantId,
      tenantName: input.tenantName,
    });
    const defaultFeedTitle = defaultBranding.publicTitle;
    const defaultFeedSubtitle = defaultBranding.publicSubtitle;

    const feedTitle = this.resolveTextField({
      override,
      key: 'feedTitle',
      templateValue: template.feedTitle,
      defaultValue: defaultFeedTitle,
      normalize: (value) => this.normalizeNullableShortText(value),
    });

    const feedSubtitle = this.resolveTextField({
      override,
      key: 'feedSubtitle',
      templateValue: template.feedSubtitle,
      defaultValue: defaultFeedSubtitle,
      normalize: (value) => this.normalizeNullableText(value),
    });

    const avatarPreset = this.resolveNullableAvatarPreset({
      override,
      templateValue: template.avatarPreset,
    });
    const avatarUrl = await this.resolveUserAvatarUrl(input.actorUserId);

    const brandPrimary = this.resolveColorToken({
      override,
      key: 'brandPrimary',
      templateValue: template.brandPrimary,
      defaultValue: DEFAULT_BRAND_PRIMARY,
    });

    const brandSecondary = this.resolveColorToken({
      override,
      key: 'brandSecondary',
      templateValue: template.brandSecondary,
      defaultValue: DEFAULT_BRAND_SECONDARY,
    });

    const heroImages = this.resolveHeroImages({
      override,
      templateValue: template.heroImages,
      defaultValue: DEFAULT_HERO_IMAGES,
    });

    const showWechatBlock = this.resolveShowWechatBlock(override, template.showWechatBlock);
    const wechatQrImageUrl = this.resolveNullableField({
      override,
      key: 'wechatQrImageUrl',
      templateValue: template.wechatQrImageUrl,
      normalize: (value) => this.normalizeNullableAssetUrl(value),
    });
    const wechatId = this.resolveNullableField({
      override,
      key: 'wechatId',
      templateValue: template.wechatId,
      normalize: (value) => this.normalizeNullableWechatId(value),
    });

    return publicSharePresentationSchema.parse({
      feedTitle,
      feedSubtitle,
      identity: {
        avatarPreset,
        avatarUrl,
      },
      theme: {
        brandPrimary,
        brandSecondary,
      },
      hero: {
        images: heroImages,
      },
      contact: {
        showWechatBlock,
        wechatQrImageUrl,
        wechatId,
      },
    });
  }

  toSharePresentationOverrideJson(
    override: SharePresentationOverride | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (typeof override === 'undefined') {
      return undefined;
    }

    if (override === null) {
      return Prisma.DbNull;
    }

    const normalized = sharePresentationOverrideSchema.parse(override);
    const output: Record<string, Prisma.InputJsonValue | null> = {};

    if (this.hasOwn(normalized, 'feedTitle')) {
      output.feedTitle = this.normalizeNullableShortText(normalized.feedTitle ?? null);
    }

    if (this.hasOwn(normalized, 'feedSubtitle')) {
      output.feedSubtitle = this.normalizeNullableText(normalized.feedSubtitle ?? null);
    }

    if (this.hasOwn(normalized, 'avatarPreset')) {
      output.avatarPreset = this.normalizeAvatarPreset(normalized.avatarPreset ?? null);
    }

    if (this.hasOwn(normalized, 'brandPrimary')) {
      output.brandPrimary = this.normalizeColorToken(normalized.brandPrimary ?? null);
    }

    if (this.hasOwn(normalized, 'brandSecondary')) {
      output.brandSecondary = this.normalizeColorToken(normalized.brandSecondary ?? null);
    }

    if (this.hasOwn(normalized, 'heroImages')) {
      output.heroImages = this.normalizeHeroImages(normalized.heroImages ?? []);
    }

    if (this.hasOwn(normalized, 'showWechatBlock')) {
      output.showWechatBlock = Boolean(normalized.showWechatBlock);
    }

    if (this.hasOwn(normalized, 'wechatQrImageUrl')) {
      output.wechatQrImageUrl = this.normalizeNullableAssetUrl(normalized.wechatQrImageUrl ?? null);
    }

    if (this.hasOwn(normalized, 'wechatId')) {
      output.wechatId = this.normalizeNullableWechatId(normalized.wechatId ?? null);
    }

    if (Object.keys(output).length === 0) {
      return Prisma.DbNull;
    }

    return output as Prisma.InputJsonValue;
  }

  private emptyTemplate(): TenantSharePresentation {
    return {
      feedTitle: null,
      feedSubtitle: null,
      avatarPreset: null,
      brandPrimary: null,
      brandSecondary: null,
      heroImages: [],
      showWechatBlock: DEFAULT_WECHAT_BLOCK_VISIBLE,
      wechatQrImageUrl: null,
      wechatId: null,
    };
  }

  private toHeroImagesJson(value: string[]): Prisma.InputJsonValue {
    return this.normalizeHeroImages(value);
  }

  private parseOverride(raw: Prisma.JsonValue | null): SharePresentationOverride {
    if (!raw) {
      return {};
    }

    const parsed = sharePresentationOverrideSchema.safeParse(raw);
    if (!parsed.success) {
      return {};
    }

    return parsed.data;
  }

  private resolveTextField(input: {
    override: SharePresentationOverride;
    key: 'feedTitle' | 'feedSubtitle';
    templateValue: string | null;
    defaultValue: string;
    normalize: (value: string | null | undefined) => string | null;
  }): string {
    if (this.hasOwn(input.override, input.key)) {
      const resolvedOverride = input.normalize(input.override[input.key] ?? null);
      return resolvedOverride ?? input.defaultValue;
    }

    const templateValue = input.normalize(input.templateValue);
    return templateValue ?? input.defaultValue;
  }

  private resolveColorToken(input: {
    override: SharePresentationOverride;
    key: 'brandPrimary' | 'brandSecondary';
    templateValue: string | null;
    defaultValue: string;
  }): string {
    if (this.hasOwn(input.override, input.key)) {
      return this.normalizeColorToken(input.override[input.key] ?? null) ?? input.defaultValue;
    }

    return this.normalizeColorToken(input.templateValue) ?? input.defaultValue;
  }

  private resolveHeroImages(input: {
    override: SharePresentationOverride;
    templateValue: string[];
    defaultValue: string[];
  }): string[] {
    if (this.hasOwn(input.override, 'heroImages')) {
      const overrideImages = this.normalizeHeroImages(input.override.heroImages ?? []);
      if (overrideImages.length > 0) {
        return overrideImages;
      }
    }

    if (input.templateValue.length > 0) {
      return input.templateValue;
    }

    return input.defaultValue;
  }

  private resolveShowWechatBlock(
    override: SharePresentationOverride,
    templateValue: boolean,
  ): boolean {
    if (this.hasOwn(override, 'showWechatBlock')) {
      return Boolean(override.showWechatBlock);
    }

    return templateValue;
  }

  private resolveNullableField<T extends 'wechatQrImageUrl' | 'wechatId'>(input: {
    override: SharePresentationOverride;
    key: T;
    templateValue: string | null;
    normalize: (value: string | null | undefined) => string | null;
  }): string | null {
    if (this.hasOwn(input.override, input.key)) {
      return input.normalize(input.override[input.key] ?? null);
    }

    return input.normalize(input.templateValue);
  }

  private resolveNullableAvatarPreset(input: {
    override: SharePresentationOverride;
    templateValue: string | null;
  }) {
    if (this.hasOwn(input.override, 'avatarPreset')) {
      return this.normalizeAvatarPreset(input.override.avatarPreset ?? null);
    }

    return this.normalizeAvatarPreset(input.templateValue);
  }

  private async resolveUserAvatarUrl(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        avatarUrl: true,
      },
    });

    return this.normalizeUserAvatarUrl(user?.avatarUrl ?? null);
  }

  private normalizeUserAvatarUrl(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }

    const storageKey = this.extractUploadStorageKey(normalized);
    if (storageKey?.includes('/user-avatar/')) {
      return `/me/avatar/assets?key=${encodeURIComponent(storageKey)}`;
    }

    return this.normalizeNullableAssetUrl(normalized);
  }

  private extractUploadStorageKey(value: string): string | null {
    try {
      const parsed = new URL(value, 'http://localhost');
      if (parsed.pathname === '/me/avatar/assets') {
        return this.normalizeStorageKey(parsed.searchParams.get('key'));
      }

      const uploadPublicBaseUrl = (process.env.UPLOAD_PUBLIC_BASE_URL ?? '/uploads').replace(
        /\/+$/,
        '',
      );
      if (
        parsed.pathname === uploadPublicBaseUrl ||
        !parsed.pathname.startsWith(`${uploadPublicBaseUrl}/`)
      ) {
        return null;
      }

      return this.normalizeStorageKey(
        decodeURIComponent(parsed.pathname.slice(uploadPublicBaseUrl.length + 1)),
      );
    } catch {
      return null;
    }
  }

  private normalizeStorageKey(rawKey: string | null | undefined): string | null {
    const key = rawKey?.replace(/\\/g, '/').replace(/^\/+/, '').trim();
    if (!key) {
      return null;
    }

    const segments = key.split('/').filter((segment) => segment.length > 0);
    if (segments.length < 2 || segments.some((segment) => segment === '..')) {
      return null;
    }

    return segments.join('/');
  }

  private normalizeHeroImages(raw: Prisma.JsonValue | string[]): string[] {
    const source = Array.isArray(raw) ? raw : this.parseHeroImagesFromJson(raw);

    const deduped = new Set<string>();
    for (const item of source) {
      const normalized = this.normalizeAssetUrl(typeof item === 'string' ? item : null);
      if (!normalized) {
        continue;
      }

      deduped.add(normalized);
    }

    return [...deduped].slice(0, 10);
  }

  private parseHeroImagesFromJson(raw: Prisma.JsonValue | null): string[] {
    const parsed = tenantSharePresentationSchema.shape.heroImages.safeParse(raw);
    if (!parsed.success) {
      return [];
    }

    return parsed.data;
  }

  private normalizeNullableShortText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    return normalized.slice(0, 120);
  }

  private normalizeNullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    return normalized.slice(0, 240);
  }

  private normalizeAvatarPreset(value: string | null | undefined) {
    const normalized = value?.trim() ?? null;
    if (!normalized) {
      return null;
    }

    const parsed = tenantShareAvatarPresetSchema.safeParse(normalized);
    return parsed.success ? parsed.data : null;
  }

  private normalizeNullableWechatId(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    return normalized.slice(0, 64);
  }

  private normalizeNullableAssetUrl(value: string | null | undefined): string | null {
    const normalized = this.normalizeAssetUrl(value);
    return normalized ?? null;
  }

  private normalizeAssetUrl(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    const parsed = tenantSharePresentationSchema.shape.wechatQrImageUrl.safeParse(normalized);
    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  }

  private normalizeColorToken(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    const parsed = tenantSharePresentationSchema.shape.brandPrimary.safeParse(normalized);
    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  }

  private resolveImageExtension(originalName: string, mimeType: string): string {
    const extensionFromName = path.extname(originalName).trim();
    if (extensionFromName) {
      return extensionFromName.toLowerCase();
    }

    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
    };

    return extensionMap[mimeType] ?? '';
  }

  private hasOwn<Key extends string>(value: object, key: Key): value is Record<Key, unknown> {
    return Object.prototype.hasOwnProperty.call(value, key);
  }
}
