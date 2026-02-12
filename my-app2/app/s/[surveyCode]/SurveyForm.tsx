'use client';


import { useMemo, useState } from 'react';


type Meta = {
  departments: { name: string }[];
  questionsByScale: Record<string, { question_code: string; question_text: string }[]>;
  choices: {
    gender: string[];
    ageBand: string[];
    likert: { value: number; label: string }[];
  };
};


const EMPLOYEE_CODE_RE = /^[A-Za-z0-9]{3,20}$/;
const SCALE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'] as const;


export default function SurveyForm({ surveyCode, meta }: { surveyCode: string; meta: Meta }) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [departmentName, setDepartmentName] = useState(meta.departments?.[0]?.name ?? '');
  const [gender, setGender] = useState('未回答');
  const [ageBand, setAgeBand] = useState('未回答');


  const allQuestions = useMemo(() => {
    const list: { code: string; text: string; scale: string }[] = [];
    for (const s of SCALE_ORDER) {
      const qs = meta.questionsByScale?.[s] ?? [];
      for (const q of qs) list.push({ code: q.question_code, text: q.question_text, scale: s });
    }
    return list;
  }, [meta]);


  const requiredQuestionCodes = useMemo(() => allQuestions.map((q) => q.code), [allQuestions]);


  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);


  const normalizeEmployeeCode = (s: string) => s.trim().toUpperCase();


  const validate = () => {
    const normalized = normalizeEmployeeCode(employeeCode);
    if (!EMPLOYEE_CODE_RE.test(normalized)) return '社員IDは半角英数字3〜20文字で入力してください（例：A00123）';
    if (!departmentName) return '部署を選択してください。';
    const missing = requiredQuestionCodes.filter((c) => !(c in answers));
    if (missing.length > 0) return '未回答の設問があります。すべて回答してください。';
    return null;
  };


  const setAnswer = (code: string, value: number) => setAnswers((prev) => ({ ...prev, [code]: value }));


  const onSubmit = async () => {
    setMessage(null);
    const err = validate();
    if (err) return setMessage({ type: 'error', text: err });


    setSubmitting(true);
    try {
      const payload = {
        employeeCode: normalizeEmployeeCode(employeeCode),
        departmentName,
        gender,
        ageBand,
        answers
      };


      const res = await fetch(`/api/surveys/${surveyCode}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });


      const data = await res.json().catch(() => ({}));


      if (res.ok) {
        setMessage({ type: 'success', text: '回答を送信しました。ご協力ありがとうございました。' });
        return;
      }


      if (res.status === 409) setMessage({ type: 'error', text: data.error ?? '回答済みのため再回答できません。' });
      else if (res.status === 403) setMessage({ type: 'error', text: data.error ?? '回答期間外です。' });
      else if (res.status === 404) setMessage({ type: 'error', text: data.error ?? 'サーベイが見つかりません。' });
      else setMessage({ type: 'error', text: data.error ?? '送信に失敗しました。時間をおいて再度お試しください。' });
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>基本情報</h2>


        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600 }}>社員ID（必須）</label>
            <input
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="例）A00123"
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
            />
            <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              半角英数字3〜20文字。入力後は大文字として扱われます。
            </div>
          </div>


          <div>
            <label style={{ display: 'block', fontWeight: 600 }}>部署（必須）</label>
            <select
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
            >
              {meta.departments.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>


          <div>
            <label style={{ display: 'block', fontWeight: 600 }}>性別（任意）</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
            >
              {meta.choices.gender.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>


          <div>
            <label style={{ display: 'block', fontWeight: 600 }}>年齢（任意）</label>
            <select
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
              style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
            >
              {meta.choices.ageBand.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>


      <div style={{ marginTop: 16, padding: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
        <h2 style={{ marginTop: 0 }}>設問（1〜6）</h2>
        <p style={{ color: '#666' }}>1=全くあてはまらない、6=非常にあてはまる</p>


        {SCALE_ORDER.map((scale) => {
          const qs = meta.questionsByScale?.[scale] ?? [];
          if (qs.length === 0) return null;


          const title =
            scale === 'A' ? 'A（キャリア）' :
            scale === 'B' ? 'B（ワークライフバランス）' :
            scale === 'C' ? 'C（職場環境）' :
            scale === 'D' ? 'D（コミュニケーション）' :
            scale === 'E' ? 'E（報酬）' :
            'F（ライスケール）';


          return (
            <div key={scale} style={{ marginTop: 20 }}>
              <h3 style={{ marginBottom: 8 }}>{title}</h3>
              {qs.map((q) => (
                <div key={q.question_code} style={{ padding: '10px 0', borderTop: '1px solid #eee' }}>
                  <div style={{ fontWeight: 600 }}>
                    {q.question_code}：{q.question_text}
                  </div>


                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                    {meta.choices.likert.map((c) => (
                      <label key={c.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="radio"
                          name={q.question_code}
                          checked={answers[q.question_code] === c.value}
                          onChange={() => setAnswer(q.question_code, c.value)}
                        />
                        <span style={{ fontSize: 13 }}>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>


      {message && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: message.type === 'success' ? '#e8fff1' : '#fff2f2',
            border: message.type === 'success' ? '1px solid #93e6b5' : '1px solid #f2a0a0'
          }}
        >
          {message.text}
        </div>
      )}


      <div style={{ marginTop: 16 }}>
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: submitting ? '#999' : '#111',
            color: '#fff',
            cursor: submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? '送信中…' : '送信する'}
        </button>
      </div>
    </section>
  );
}
