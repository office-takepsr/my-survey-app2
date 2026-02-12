import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


type Gender = '未回答' | '男性' | '女性' | 'その他' | '回答しない';
type AgeBand = '未回答' | '〜20代' | '30代' | '40代' | '50代' | '60代〜';


type SubmitBody = {
  employeeCode: string;
  departmentName: string;
  gender?: Gender;
  ageBand?: AgeBand;
  answers: Record<string, number>;
};


const EMPLOYEE_CODE_RE = /^[A-Za-z0-9]{3,20}$/;
const SCALE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'] as const;


function normalizeEmployeeCode(s: string) {
  return s.trim().toUpperCase();
}


function assertScore(n: unknown) {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 6;
}


export async function POST(
  req: Request,
  { params }: { params: Promise<{ surveyCode: string }> }
) {
  const { surveyCode } = await params;


  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSONが不正です' }, { status: 400 });
  }


  const employeeCode = normalizeEmployeeCode(body.employeeCode ?? '');
  if (!EMPLOYEE_CODE_RE.test(employeeCode)) {
    return NextResponse.json(
      { error: '社員IDは半角英数字3〜20文字で入力してください' },
      { status: 400 }
    );
  }
  if (!body.departmentName) {
    return NextResponse.json({ error: '部署は必須です' }, { status: 400 });
  }
  if (!body.answers || typeof body.answers !== 'object') {
    return NextResponse.json({ error: 'answersが不正です' }, { status: 400 });
  }


  // 1) survey取得＆期間チェック
  const { data: survey, error: surveyErr } = await supabaseAdmin
    .from('surveys')
    .select('id, code, start_at, end_at, status')
    .eq('code', surveyCode)
    .single();


  if (surveyErr || !survey) {
    return NextResponse.json({ error: 'サーベイが見つかりません' }, { status: 404 });
  }


  const now = new Date();
  const startAt = new Date(survey.start_at);
  const endAt = new Date(survey.end_at);


  if (survey.status !== 'open' || now < startAt || now > endAt) {
    return NextResponse.json({ error: '回答期間外です' }, { status: 403 });
  }


  // 2) 部署id取得
  const { data: dept, error: deptErr } = await supabaseAdmin
    .from('departments')
    .select('id, name')
    .eq('name', body.departmentName)
    .eq('is_active', true)
    .single();


  if (deptErr || !dept) {
    return NextResponse.json({ error: '部署が不正です' }, { status: 400 });
  }


  // 3) questions取得（コード→id/scale/is_reverse）
  const codes = Object.keys(body.answers);
  if (codes.length === 0) {
    return NextResponse.json({ error: '回答が空です' }, { status: 400 });
  }


  const { data: questions, error: qErr } = await supabaseAdmin
    .from('questions')
    .select('id, question_code, scale, is_reverse, is_active')
    .in('question_code', codes);


  if (qErr || !questions) {
    return NextResponse.json({ error: '設問取得に失敗しました' }, { status: 500 });
  }


  const qMap = new Map(
    questions
      .filter((q) => q.is_active && SCALE_ORDER.includes(q.scale as any))
      .map((q) => [q.question_code, q])
  );


  for (const code of codes) {
    if (!qMap.has(code)) {
      return NextResponse.json({ error: `不正な設問コード: ${code}` }, { status: 400 });
    }
    if (!assertScore(body.answers[code])) {
      return NextResponse.json({ error: `不正な点数: ${code}` }, { status: 400 });
    }
  }


  // 4) employees upsert（任意属性は未回答ならnull）
  const gender = body.gender ?? null;
  const ageBand = body.ageBand ?? null;


  const { data: upsertedEmployees, error: empErr } = await supabaseAdmin
    .from('employees')
    .upsert(
      {
        employee_code: employeeCode,
        department_id: dept.id,
        gender: gender && gender !== '未回答' ? gender : null,
        age_band: ageBand && ageBand !== '未回答' ? ageBand : null
      },
      { onConflict: 'employee_code' }
    )
    .select('id, employee_code')
    .limit(1);


  if (empErr || !upsertedEmployees || upsertedEmployees.length === 0) {
    return NextResponse.json({ error: '社員情報の登録に失敗しました' }, { status: 500 });
  }


  const employeeId = upsertedEmployees[0].id;


  // 5) responses insert（再回答不可）
  const { data: responseRow, error: respErr } = await supabaseAdmin
    .from('responses')
    .insert({ survey_id: survey.id, employee_id: employeeId })
    .select('id')
    .single();


  if (respErr || !responseRow) {
    return NextResponse.json(
      { error: 'この社員IDは今回のサーベイで回答済みのため、再回答できません' },
      { status: 409 }
    );
  }


  const responseId = responseRow.id;


  // 6) response_items bulk insert（Fは逆転）
  const items = codes.map((code) => {
    const q = qMap.get(code)!;
    const raw = body.answers[code];
    const scored = q.is_reverse ? 7 - raw : raw;


    return {
      response_id: responseId,
      question_id: q.id,
      raw_score: raw,
      scored_score: scored
    };
  });


  const { error: itemsErr } = await supabaseAdmin.from('response_items').insert(items);


  if (itemsErr) {
    await supabaseAdmin.from('responses').delete().eq('id', responseId);
    return NextResponse.json({ error: '回答保存に失敗しました' }, { status: 500 });
  }


  return NextResponse.json({ ok: true }, { status: 200 });
}
