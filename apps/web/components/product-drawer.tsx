'use client';

import { type Product } from '@eggturtle/shared';

import ProductCreateDrawer, {
  type ProductCreateResult
} from '@/components/product-drawer/create';
import ProductEditDrawer from '@/components/product-drawer/edit';
import { type ProductSeriesOption } from '@/components/product-drawer/shared';

type ProductDrawerCreateProps = {
  mode: 'create';
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  isDemoMode: boolean;
  seriesOptions: ProductSeriesOption[];
  onSeriesCreated: (series: ProductSeriesOption) => void;
  onCreated: (result: ProductCreateResult) => Promise<void> | void;
};

type ProductDrawerEditProps = {
  mode: 'edit';
  open: boolean;
  product: Product | null;
  tenantSlug: string;
  isDemoMode: boolean;
  seriesOptions?: ProductSeriesOption[];
  onClose: () => void;
  onSaved: (product: Product) => void;
  onSeriesCreated?: (series: ProductSeriesOption) => void;
};

export type ProductDrawerProps = ProductDrawerCreateProps | ProductDrawerEditProps;

export type { ProductCreateResult };
export type { ProductSeriesOption } from '@/components/product-drawer/shared';

export default function ProductDrawer(props: ProductDrawerProps) {
  if (props.mode === 'create') {
    return (
      <ProductCreateDrawer
        open={props.open}
        onClose={props.onClose}
        tenantSlug={props.tenantSlug}
        isDemoMode={props.isDemoMode}
        seriesOptions={props.seriesOptions}
        onSeriesCreated={props.onSeriesCreated}
        onCreated={props.onCreated}
      />
    );
  }

  return (
    <ProductEditDrawer
      open={props.open}
      product={props.product}
      tenantSlug={props.tenantSlug}
      isDemoMode={props.isDemoMode}
      seriesOptions={props.seriesOptions}
      onClose={props.onClose}
      onSaved={props.onSaved}
      onSeriesCreated={props.onSeriesCreated}
    />
  );
}
