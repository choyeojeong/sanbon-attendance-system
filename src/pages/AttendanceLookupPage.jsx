// src/pages/AttendanceLookupPage.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

function AttendanceLookupPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [student, setStudent] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'));

  useEffect(() => {
    if (student) fetchLessons();
  }, [student, weekStart]);

  const fetchLessons = async () => {
    const weekDates = [...Array(7)].map((_, i) => weekStart.add(i, 'day').format('YYYY-MM-DD'));
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .in('date', weekDates)
      .eq('student_id', student.id)
      .order('date')
      .order('time');
    setLessons(data || []);
  };

  const handleLogin = async () => {
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('name', name)
      .eq('phone', phone)
      .single();
    if (data) setStudent(data);
    else alert('학생 정보를 찾을 수 없습니다.');
  };

  const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
  const grouped = lessons.reduce((acc, lesson) => {
    const day = lesson.date;
    if (!acc[day]) acc[day] = [];
    acc[day].push(lesson);
    return acc;
  }, {});

  return (
    <div style={{ padding: 20 }}>
      {!student ? (
        <div>
          <h2>출결 조회</h2>
          <input placeholder="학생 이름" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="전화번호" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button onClick={handleLogin}>조회하기</button>
        </div>
      ) : (
        <div>
          <h2>{student.name}님의 출결 조회</h2>
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setWeekStart(weekStart.subtract(1, 'week'))}>이전 주</button>
            <span style={{ margin: '0 12px' }}>{weekStart.format('MM월 DD일')} ~ {weekStart.add(6, 'day').format('MM월 DD일')}</span>
            <button onClick={() => setWeekStart(weekStart.add(1, 'week'))}>다음 주</button>
          </div>

          {Object.entries(grouped).map(([date, dayLessons]) => (
            <div key={date} style={{ marginBottom: 20 }}>
              <h3>{date} ({weekdays[dayjs(date).day()]})</h3>
              <table border="1" cellPadding="6" style={{ width: '100%' }}>
                <thead>
                  <tr><th>시간</th><th>상태</th><th>앱메모</th><th>등원</th><th>지각</th></tr>
                </thead>
                <tbody>
                  {dayLessons.map((l) => {
                    const late = l.start && l.time && l.start > l.time;
                    const memo = l.app_memo || '';
                    return (
                      <tr key={l.id}>
                        <td>{l.time}</td>
                        <td>
                          {l.status || ''}<br />
                          {l.status === '보강' && l.memo?.includes('원결석일') && (
                            <span style={{ fontSize: '0.9em', color: 'gray' }}>{l.memo}</span>
                          )}
                        </td>
                        <td>{memo}</td>
                        <td>{l.start || '-'}</td>
                        <td>{late ? '🕒 지각' : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AttendanceLookupPage;
