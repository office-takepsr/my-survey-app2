import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


type MetaResponse = {
  survey: {
    code: string;
    name: string;
    start_at: string;
    end_at: string;
    status: string;
  };
  departments: { name: string }[];
  questionsByScale: Record<string, { question_code: string; question_text: string }[]>;
  choices: {
    gender: string[];
    ageBand: string[];
    likert: { value: number; label: string }[];
  };
};


const SCALE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];


export async function GET(
  _req: Request,
  { params }: { params: Promise<{ surveyCode: string }> }
) {
  const { surveyCode } = await params;


  // survey取得
  const { data: survey, error: surveyErr } = await supabaseAdmin
    .from('surveys')
    .select('code, name, start_at, end_at, status')
    .eq('code', surveyCode)
    .single();


  if (surveyErr || !survey) {
    return NextResponse.json({ error: 'サーベイが見つかりません' }, { status: 404 });
  }


  // 部署（アクティブのみ、sort_order順）
  const { data: departments, error: deptErr } = await supabaseAdmin
    .from('departments')
    .select('name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });


  if (deptErr || !departments) {
    return NextResponse.json({ error: '部署取得に失敗しました' }, { status: 500 });
  }


  // 設問（アクティブのみ、display_order順）
  const { data: questions, error: qErr } = await supabaseAdmin
    .from('questions')
    .select('question_code, scale, question_text, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });


  if (qErr || !questions) {
    return NextResponse.json({ error: '設問取得に失敗しました' }, { status: 500 });
  }


  // scaleごとにまとめる（A→E→F）
  const questionsByScale: MetaResponse['questionsByScale'] = {};
  for (const scale of SCALE_ORDER) questionsByScale[scale] = [];


  for (const q of questions) {
    if (!questionsByScale[q.scale]) continue;
    questionsByScale[q.scale].push({
      question_code: q.question_code,
      question_text: q.question_text,
    });
  }


  const res: MetaResponse = {
    survey,
    departments,
    questionsByScale,
    choices: {
      gender: ['未回答', '男性', '女性', 'その他', '回答しない'],
      ageBand: ['未回答', '〜20代', '30代', '40代', '50代', '60代〜'],
      likert: [
        { value: 1, label: '全くあてはまらない（1）' },
        { value: 2, label: 'あてはまらない（2）' },
        { value: 3, label: 'ややあてはまらない（3）' },
        { value: 4, label: 'ややあてはまる（4）' },
        { value: 5, label: 'あてはまる（5）' },
        { value: 6, label: '非常にあてはまる（6）' },
      ],
    },
  };


  return NextResponse.json(res, { status: 200 });
}
