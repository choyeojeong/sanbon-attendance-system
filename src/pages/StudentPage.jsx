import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import dayjs from 'dayjs';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_MAP = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };

function StudentPage() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    name: '',
    school: '',
    grade: '',
    teacher: '',
    phone: '',
    parent_phone: '', // ✅ 추가
    first_day: '',
    one_day: '',
    one_test_time: '',
    one_class_time: '',
    reading_schedule: {},
  });
  const [editingId, setEditingId] = useState(null);
  const [withdrawDate, setWithdrawDate] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('name');
    setStudents(data || []);
  };

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleReadingDayToggle = (day) => {
    setForm((prev) => {
      const updated = { ...prev.reading_schedule };
      if (updated[day] !== undefined) {
        delete updated[day];
      } else {
        updated[day] = '';
      }
      return { ...prev, reading_schedule: updated };
    });
  };

  const handleReadingTimeChange = (day, value) => {
    setForm((prev) => ({
      ...prev,
      reading_schedule: { ...prev.reading_schedule, [day]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.first_day || !form.one_day || !form.one_class_time) {
      alert('이름, 첫수업일, 일대일 요일/시간은 필수입니다.');
      return;
    }

    if (editingId) {
      await supabase.from('students').update(form).eq('id', editingId);
      await supabase.from('lessons').delete()
        .gte('date', dayjs().format('YYYY-MM-DD'))
        .eq('student_id', editingId);
      await generateLessons({ id: editingId, ...form });
      setEditingId(null);
    } else {
      const { data: inserted } = await supabase
        .from('students')
        .insert(form)
        .select()
        .single();

      if (inserted) {
        await generateLessons(inserted);
      }
    }

    setForm({
      name: '',
      school: '',
      grade: '',
      teacher: '',
      phone: '',
      parent_phone: '', // ✅ 초기화
      first_day: '',
      one_day: '',
      one_test_time: '',
      one_class_time: '',
      reading_schedule: {},
    });
    fetchStudents();
  };

  const generateLessons = async (student) => {
    const start = dayjs(student.first_day);
    const end = start.add(7, 'year');
    const lessons = [];

    const oneWeekday = DAY_MAP[student.one_day];
    let oneDate = start.startOf('week').add(oneWeekday, 'day');
    if (oneDate.isBefore(start)) oneDate = oneDate.add(1, 'week');

    while (oneDate.isBefore(end)) {
      lessons.push({
        student_id: student.id,
        date: oneDate.format('YYYY-MM-DD'),
        time: student.one_class_time,
        teacher: student.teacher,
        type: '일대일',
        status: '',
      });
      oneDate = oneDate.add(1, 'week');
    }

    for (const [day, time] of Object.entries(student.reading_schedule || {})) {
      const dayIndex = DAY_MAP[day];
      if (dayIndex === undefined) continue;
      let readingDate = start.startOf('week').add(dayIndex, 'day');
      if (readingDate.isBefore(start)) readingDate = readingDate.add(1, 'week');

      while (readingDate.isBefore(end)) {
        lessons.push({
          student_id: student.id,
          date: readingDate.format('YYYY-MM-DD'),
          time,
          teacher: student.teacher,
          type: '독해',
          status: '',
        });
        readingDate = readingDate.add(1, 'week');
      }
    }

    for (let i = 0; i < lessons.length; i += 500) {
      await supabase.from('lessons').insert(lessons.slice(i, i + 500));
    }
  };

  const handleEdit = (student) => {
    setForm(student);
    setEditingId(student.id);
  };

  const handleDelete = async (studentId) => {
    if (!withdrawDate) return alert('퇴원일을 입력해주세요.');
    await supabase.from('lessons').delete().gte('date', withdrawDate).eq('student_id', studentId);
    await supabase.from('students').delete().eq('id', studentId);
    setWithdrawDate('');
    fetchStudents();
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#fffaf0' }}>
      <h2>학생 관리</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
        <input name="name" placeholder="이름" value={form.name} onChange={handleChange} />
        <input name="school" placeholder="학교" value={form.school} onChange={handleChange} />
        <input name="grade" placeholder="학년" value={form.grade} onChange={handleChange} />
        <input name="teacher" placeholder="담당선생님" value={form.teacher} onChange={handleChange} />
        <input name="phone" placeholder="전화번호 (예: 01012345678)" value={form.phone} onChange={handleChange} />
        <input name="parent_phone" placeholder="학부모 전화번호 (예: 01012345678)" value={form.parent_phone} onChange={handleChange} /> {/* ✅ 추가 */}
        <input name="first_day" type="date" value={form.first_day} onChange={handleChange} />

        <div style={{ marginTop: '20px' }}>
          <h4>일대일 수업</h4>
          <label>요일: </label>
          <select name="one_day" value={form.one_day} onChange={handleChange}>
            <option value="">선택</option>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input name="one_test_time" placeholder="테스트 시간" value={form.one_test_time} onChange={handleChange} />
          <input name="one_class_time" placeholder="수업 시간" value={form.one_class_time} onChange={handleChange} />
        </div>

        <div style={{ marginTop: '20px' }}>
          <h4>독해 수업</h4>
          {WEEKDAYS.map((d) => (
            <div key={d}>
              <label>
                <input
                  type="checkbox"
                  checked={form.reading_schedule[d] !== undefined}
                  onChange={() => handleReadingDayToggle(d)}
                />
                {d}
              </label>
              {form.reading_schedule[d] !== undefined && (
                <input
                  type="text"
                  placeholder="시간 (예: 17:20)"
                  value={form.reading_schedule[d]}
                  onChange={(e) => handleReadingTimeChange(d, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <button type="submit">{editingId ? '수정' : '등록'}</button>
      </form>

      <div>
        <label>퇴원일 입력 후 삭제: </label>
        <input type="date" value={withdrawDate} onChange={(e) => setWithdrawDate(e.target.value)} />
      </div>

      <table border="1" cellPadding="8" style={{ marginTop: '20px', width: '100%' }}>
        <thead style={{ backgroundColor: '#f5f5dc' }}>
          <tr>
            <th>번호</th>
            <th>이름</th>
            <th>학교</th>
            <th>학년</th>
            <th>선생님</th>
            <th>일대일요일</th>
            <th>일대일test</th>
            <th>일대일수업</th>
            <th>독해 요일별 시간</th>
            <th>수정</th>
            <th>삭제</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td>{s.name}</td>
              <td>{s.school}</td>
              <td>{s.grade}</td>
              <td>{s.teacher}</td>
              <td>{s.one_day}</td>
              <td>{s.one_test_time}</td>
              <td>{s.one_class_time}</td>
              <td>{Object.entries(s.reading_schedule || {}).map(([d, t]) => `${d} ${t}`).join(', ')}</td>
              <td><button onClick={() => handleEdit(s)}>수정</button></td>
              <td><button onClick={() => handleDelete(s.id)}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default StudentPage;
