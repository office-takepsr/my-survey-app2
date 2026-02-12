import SurveyForm from './SurveyForm';


export default async function Page({ params }: { params: Promise<{ surveyCode: string }> }) {
  const { surveyCode } = await params;


  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/surveys/${surveyCode}/meta`, { cache: 'no-store' });


  if (!res.ok) {
    const msg = res.status === 404 ? 'サーベイが見つかりません' : '読み込みに失敗しました';
    return (
      <main style={{ maxWidth: 900, margin: '24px auto', padding: 16 }}>
        <h1>サーベイ回答</h1>
        <p>{msg}</p>
      </main>
    );
  }


  const meta = await res.json();


  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: 16 }}>
      <h1>{meta.survey?.name ?? 'サーベイ回答'}</h1>
      <p style={{ color: '#555' }}>
        実施期間：{new Date(meta.survey.start_at).toLocaleString('ja-JP')} 〜{' '}
        {new Date(meta.survey.end_at).toLocaleString('ja-JP')}
      </p>
      <SurveyForm surveyCode={surveyCode} meta={meta} />
    </main>
  );
}
