import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import {
  verifyProductCertificateResponseSchema
} from '@eggturtle/shared';

import { ProductGeneratedAssetsService } from './product-generated-assets.service';

type PublicPassthroughResponse = {
  setHeader: (name: string, value: string) => void;
  redirect: (url: string) => void;
};

@Controller('public/certificates')
export class ProductCertificatesPublicController {
  constructor(private readonly generatedAssetsService: ProductGeneratedAssetsService) {}

  @Get('verify/:verifyId')
  async verifyCertificate(@Param('verifyId') verifyId: string) {
    const response = await this.generatedAssetsService.verifyCertificate(verifyId.trim());
    return verifyProductCertificateResponseSchema.parse(response);
  }

  @Get('verify/:verifyId/content')
  async getVerifiedCertificateContent(
    @Param('verifyId') verifyId: string,
    @Res({ passthrough: true }) response: PublicPassthroughResponse
  ) {
    const content = await this.generatedAssetsService.getVerifiedCertificateContent(verifyId.trim());

    response.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

    if ('redirectUrl' in content) {
      response.redirect(content.redirectUrl);
      return;
    }

    if (content.contentType) {
      response.setHeader('Content-Type', content.contentType);
    }

    return new StreamableFile(content.content);
  }
}
