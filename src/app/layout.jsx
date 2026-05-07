import '@/index.css';

export const metadata = {
  title: 'MelaEat',
  description: 'Ethiopian food delivery',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
