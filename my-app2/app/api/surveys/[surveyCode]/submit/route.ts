import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ surveyCode: string }> }
) {
  try {
    // 1. URLからsurveyCodeを取得（Next.js 15の書き方）
    const { surveyCode } = await params;

    // 2. フォームから送られてきた中身（回答）を取り出す
    const body = await request.json();
    const { answers } = body;

    // 3. Supabaseの 'responses' テーブルに保存
    // ※テーブル名は自分の設定に合わせて適宜変更してください
    const { error } = await supabaseAdmin
      .from('responses') 
      .insert([
        { 
          survey_code: surveyCode, 
          answer_data: answers,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    return NextResponse.json({ message: '保存完了しました！' }, { status: 200 });

  } catch (error: any) {
    console.error('Error saving response:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}