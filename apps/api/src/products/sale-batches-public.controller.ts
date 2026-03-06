import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';

import { ProductSaleBatchesService } from './product-sale-batches.service';

type PublicPassthroughResponse = {
  setHeader: (name: string, value: string) => void;
  redirect: (url: string) => void;
};

@Controller('public/sale-batches')
export class SaleBatchesPublicController {
  constructor(private readonly productSaleBatchesService: ProductSaleBatchesService) {}

  @Get(':batchId/subject-media/:mediaId/content')
  async getSaleSubjectMediaContent(
    @Param('batchId') saleBatchId: string,
    @Param('mediaId') mediaId: string,
    @Res({ passthrough: true }) response: PublicPassthroughResponse
  ) {
    const content = await this.productSaleBatchesService.getSaleSubjectMediaContent(
      saleBatchId.trim(),
      mediaId.trim()
    );

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
