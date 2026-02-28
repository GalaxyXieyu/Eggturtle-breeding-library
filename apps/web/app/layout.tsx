import '../../../packages/shared/styles/ui-foundation.css';
import './globals.css';

export const metadata = {
  title: 'Eggturtle Node Rebuild',
  description: 'Next.js app for the new Node.js stack.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
