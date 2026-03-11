import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import {
  verifyProductCertificateResponseSchema
} from '@eggturtle/shared';

import { ProductCertificateVerificationService } from './product-certificate-verification.service';

type PublicPassthroughResponse = {
  setHeader: (name: string, value: string) => void;
  redirect: (url: string) => void;
};

@Controller('public/certificates')
export class ProductCertificatesPublicController {
  constructor(private readonly productCertificateVerificationService: ProductCertificateVerificationService) {}

  @Get('verify/:verifyId')
  async verifyCertificate(@Param('verifyId') verifyId: string) {
    const response = await this.productCertificateVerificationService.verifyCertificate(verifyId.trim());
    return verifyProductCertificateResponseSchema.parse(response);
  }

  @Get('verify/:verifyId/content')
  async getVerifiedCertificateContent(
    @Param('verifyId') verifyId: string,
    @Query('maxEdge') maxEdge: string | undefined,
    @Res({ passthrough: true }) response: PublicPassthroughResponse
  ) {
    const content = await this.productCertificateVerificationService.getVerifiedCertificateContent(verifyId.trim(), {
      maxEdge: maxEdge ? Number(maxEdge) : undefined
    });

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
