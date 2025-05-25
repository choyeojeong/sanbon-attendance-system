import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(weekday);
dayjs.extend(isoWeek);

const weekdays = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function ReadingAttendancePage() {
  const [weekStart, setWeekStart] = useState(dayjs().startOf('week').add(1, 'day'));
  const [lessonsByDay, setLessonsByDay] = useState({});
  const [studentsMap, setStudentsMap] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [absentInfoMap, setAbsentInfoMap] = useState({});
  const [makeupMap, setMakeupMap] = useState({});
  const [moveTargetId, setMoveTargetId] = useState(null);
  const [moveInfoMap, setMoveInfoMap] = useState({});
  const [allStudents, setAllStudents] = useState([]);
  const [newMakeup, setNewMakeup] = useState({ studentName: '', date: '', time: '', memo: '' });

  useEffect(() => { fetchLessons(); }, [weekStart]);
  const fetchLessons = async () => {
    const weekDates = [...Array(6)].map((_, i) => weekStart.add(i, 'day').format('YYYY-MM-DD'));
    const { data: lessons } = await supabase
      .from('lessons')
      .select('*')
      .in('date', weekDates)
      .eq('type', '독해')
      .order('time');

    const { data: students } = await supabase.from('students').select('*');
    const map = {};
    students.forEach((s) => (map[s.id] = s));
    setStudentsMap(map);
    setAllStudents(students);

    const grouped = {};
    const makeupMapTemp = {};

    for (const date of weekDates) {
      grouped[date] = lessons.filter((l) => l.date === date);
    }

    for (const lesson of lessons) {
      if (lesson.status?.includes('결석')) {
        const { data: linked } = await supabase
          .from('lessons')
          .select('*')
          .ilike('memo', `%원결석일: ${lesson.date}%`)
          .eq('student_id', lesson.student_id)
          .eq('teacher', lesson.teacher)
          .eq('type', '독해')
          .eq('status', '보강');
        if (linked?.length > 0) makeupMapTemp[lesson.id] = linked[0];
      }
    }

    setMakeupMap(makeupMapTemp);
    setLessonsByDay(grouped);
  };

  const handleAbsent = (lesson) => {
    setEditingId(lesson.id);
    setAbsentInfoMap((prev) => ({
      ...prev,
      [lesson.id]: { reason: '', makeup: '보강O', date: '', time: '' },
    }));
  };

  const handleSaveAbsent = async (lesson) => {
    const info = absentInfoMap[lesson.id];
    await supabase
      .from('lessons')
      .update({
        status: info.makeup === '보강X' ? '결석(보강X)' : '결석(보강O)',
        memo: `사유:${info.reason}`,
      })
      .eq('id', lesson.id);

    if (info.makeup === '보강O') {
      await supabase.from('lessons').insert({
        student_id: lesson.student_id,
        date: info.date,
        time: info.time,
        teacher: lesson.teacher,
        type: '독해',
        status: '보강',
        memo: `원결석일: ${lesson.date} / 사유: ${info.reason}`,
      });
    }

    // ✅ FCM 알림 전송
    const student = studentsMap[lesson.student_id];
    if (student?.fcm_token) {
      await fetch('https://YOUR_PROJECT_REF.functions.supabase.co/notify-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: student.fcm_token,
          title: '📢 결석 처리 알림',
          body: `${student.name} 학생이 ${lesson.time} 수업에 결석 처리되었습니다.`,
        }),
      });
    }

    setEditingId(null);
    fetchLessons();
  };
  const handleResetStatus = async (lesson) => {
    const { data: linked } = await supabase
      .from('lessons')
      .select('id')
      .ilike('memo', `%원결석일: ${lesson.date}%`)
      .eq('student_id', lesson.student_id)
      .eq('teacher', lesson.teacher)
      .eq('type', '독해')
      .eq('status', '보강');

    if (linked?.length > 0) {
      await supabase.from('lessons').delete().in('id', linked.map((l) => l.id));
    }

    await supabase
      .from('lessons')
      .update({ status: '', memo: '', start: null, end: null })
      .eq('id', lesson.id);

    fetchLessons();
  };

  const handleMemoChange = async (lesson, memo) => {
    await supabase.from('lessons').update({ memo }).eq('id', lesson.id);
  };

  const handleDeleteLesson = async (lesson) => {
    await supabase.from('lessons').delete().eq('id', lesson.id);
    fetchLessons();
  };

  const handleMoveClick = (lessonId) => {
    setMoveTargetId(lessonId);
    setMoveInfoMap((prev) => ({ ...prev, [lessonId]: { date: '', time: '' } }));
  };

  const handleMoveSave = async (lesson) => {
    const moveInfo = moveInfoMap[lesson.id];
    const reason = lesson.memo?.match(/사유:\s?(.+)/)?.[1] || '';

    await supabase
      .from('lessons')
      .delete()
      .ilike('memo', `%원결석일: ${lesson.date}%`)
      .eq('student_id', lesson.student_id)
      .eq('teacher', lesson.teacher)
      .eq('type', '독해')
      .eq('status', '보강');

    await supabase.from('lessons').insert({
      student_id: lesson.student_id,
      date: moveInfo.date,
      time: moveInfo.time,
      teacher: lesson.teacher,
      type: '독해',
      status: '보강',
      memo: `원결석일: ${lesson.date} / 사유: ${reason}`,
    });

    // ✅ FCM 알림 전송
    const student = studentsMap[lesson.student_id];
    if (student?.fcm_token) {
      await fetch('https://YOUR_PROJECT_REF.functions.supabase.co/notify-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: student.fcm_token,
          title: '📢 보강 이동 알림',
          body: `${student.name} 학생의 보강 수업이 ${moveInfo.date} ${moveInfo.time}로 이동되었습니다.`,
        }),
      });
    }

    setMoveTargetId(null);
    fetchLessons();
  };
  const handleNewMakeupSubmit = async () => {
    const student = allStudents.find((s) => s.name === newMakeup.studentName.trim());
    if (!student || !newMakeup.date || !newMakeup.time) return alert('모든 항목을 입력하세요.');

    await supabase.from('lessons').insert({
      student_id: student.id,
      date: newMakeup.date,
      time: newMakeup.time,
      teacher: student.teacher,
      type: '독해',
      status: '보강',
      memo: newMakeup.memo || '',
    });

    setNewMakeup({ studentName: '', date: '', time: '', memo: '' });
    fetchLessons();
  };

  const handleWeekChange = (offset) => {
    setWeekStart(weekStart.add(offset, 'week'));
  };

  const formatStatusText = (lesson) => {
    let statusText = lesson.status || '';

    if (lesson.status?.startsWith('출석') && lesson.start) {
      const endTime = dayjs(`${lesson.date} ${lesson.start}`).add(90, 'minute').format('HH:mm');
      statusText += `\n출석시간: ${lesson.start}\n종료시간: ${endTime}`;
    }

    if (lesson.status?.includes('결석') && makeupMap[lesson.id]) {
      const makeup = makeupMap[lesson.id];
      const reason = lesson.memo?.match(/사유:\s?(.+)/)?.[1] || '';
      statusText += `\n사유: ${reason}\n보강일: ${makeup.date} ${makeup.time}`;
    } else if (lesson.status === '보강' && lesson.memo?.includes('원결석일')) {
      const [, origin, reason] = lesson.memo.match(/원결석일:\s?([\d-]+)\s?\/\s?사유:\s?(.+)/) || [];
      statusText += `\n원결석일: ${origin}\n사유: ${reason}`;
    }

    return statusText;
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f9f9f9' }}>
      <h2>독해 수업 출결 관리</h2>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => handleWeekChange(-1)}>이전 주</button>
        <span style={{ margin: '0 15px' }}>
          {weekStart.format('YYYY년 MM월 DD일')} ~ {weekStart.add(5, 'day').format('MM월 DD일')}
        </span>
        <button onClick={() => handleWeekChange(1)}>다음 주</button>
      </div>

      {Object.entries(lessonsByDay).map(([date, lessons], idx) => (
        <div key={date} style={{ marginBottom: '30px', backgroundColor: '#ffffff', padding: '15px', border: '1px solid #ddd' }}>
          <h3>{weekdays[idx]} ({date}) - 수업 인원 {lessons.length}명</h3>
          <table border="1" cellPadding="8" style={{ width: '100%', backgroundColor: '#fff' }}>
            <thead style={{ backgroundColor: '#f0f0f0' }}>
              <tr><th>시간</th><th>학생명</th><th>학교</th><th>학년</th><th>상태</th><th>메모</th><th>출결</th><th>삭제</th></tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => {
                const student = studentsMap[lesson.student_id];
                const isEditing = editingId === lesson.id;
                const info = absentInfoMap[lesson.id] || {};
                const isAbsent = lesson.status?.includes('결석');
                const isMakeup = lesson.status === '보강';

                return (
                  <tr key={lesson.id} style={{ backgroundColor: isMakeup ? '#e0f7fa' : 'white' }}>
                    <td>{lesson.time}</td>
                    <td>{student?.name || ''}</td>
                    <td>{student?.school || ''}</td>
                    <td>{student?.grade || ''}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{formatStatusText(lesson)}</td>
                    <td>
                      <input
                        type="text"
                        defaultValue={
                          !lesson.memo?.startsWith('원결석일') &&
                          !lesson.memo?.startsWith('사유:')
                            ? lesson.memo
                            : ''
                        }
                        placeholder="메모 입력"
                        onBlur={(e) => handleMemoChange(lesson, e.target.value)}
                      />
                    </td>
                    <td>
                      {isEditing ? (
                        <div>
                          <input type="text" placeholder="사유" value={info.reason} onChange={(e) => setAbsentInfoMap(prev => ({ ...prev, [lesson.id]: { ...info, reason: e.target.value } }))} />
                          <select value={info.makeup} onChange={(e) => setAbsentInfoMap(prev => ({ ...prev, [lesson.id]: { ...info, makeup: e.target.value } }))}>
                            <option value="보강O">보강O</option>
                            <option value="보강X">보강X</option>
                          </select>
                          {info.makeup === '보강O' && (
                            <>
                              <input type="date" value={info.date} onChange={(e) => setAbsentInfoMap(prev => ({ ...prev, [lesson.id]: { ...info, date: e.target.value } }))} />
                              <input placeholder="수업시간" value={info.time} onChange={(e) => setAbsentInfoMap(prev => ({ ...prev, [lesson.id]: { ...info, time: e.target.value } }))} />
                            </>
                          )}
                          <button onClick={() => handleSaveAbsent(lesson)}>저장</button>
                        </div>
                      ) : (
                        <>
                          {!isAbsent && (
                            <button onClick={() => handleAbsent(lesson)}>결석</button>
                          )}
                          {isAbsent && (
                            <>
                              <button onClick={() => handleResetStatus(lesson)}>출결초기화</button>
                              {makeupMap[lesson.id] && (
                                <button onClick={() => handleMoveClick(lesson.id)}>보강이동</button>
                              )}
                            </>
                          )}
                          {moveTargetId === lesson.id && (
                            <div>
                              <input type="date" value={moveInfoMap[lesson.id]?.date || ''} onChange={(e) => setMoveInfoMap(prev => ({ ...prev, [lesson.id]: { ...moveInfoMap[lesson.id], date: e.target.value } }))} />
                              <input placeholder="수업시간" value={moveInfoMap[lesson.id]?.time || ''} onChange={(e) => setMoveInfoMap(prev => ({ ...prev, [lesson.id]: { ...moveInfoMap[lesson.id], time: e.target.value } }))} />
                              <button onClick={() => handleMoveSave(lesson)}>보강이동 저장</button>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <button onClick={() => handleDeleteLesson(lesson)}>삭제</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ marginTop: '40px', padding: '20px', border: '2px dashed #aaa', background: '#eef6fa' }}>
        <h3>📘 결석 없이 보강 수업 추가</h3>
        <input type="text" placeholder="학생 이름 입력" value={newMakeup.studentName} onChange={(e) => setNewMakeup((prev) => ({ ...prev, studentName: e.target.value }))} />
        <input type="date" value={newMakeup.date} onChange={(e) => setNewMakeup((prev) => ({ ...prev, date: e.target.value }))} />
        <input type="text" placeholder="수업시간 (예: 18:00)" value={newMakeup.time} onChange={(e) => setNewMakeup((prev) => ({ ...prev, time: e.target.value }))} />
        <input type="text" placeholder="메모 (선택 입력)" value={newMakeup.memo} onChange={(e) => setNewMakeup((prev) => ({ ...prev, memo: e.target.value }))} />
        <button onClick={handleNewMakeupSubmit}>보강 수업 추가</button>
      </div>
    </div>
  );
}

export default ReadingAttendancePage;
