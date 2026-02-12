import '@/styles/globals.css';


export const metadata = {
  title: 'Survey App',
  description: 'Engagement survey form'
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}


app/page.tsx（トップ。動作確認用）


Copy
export default function Home() {
  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: 16 }}>
      <h1>Survey App</h1>
      <p>例：<a href="/s/2026-02">/s/2026-02</a></p>
    </main>
  );
}
