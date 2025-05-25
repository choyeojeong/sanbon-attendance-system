import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

function OneToOneClassPage() {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [lessons, setLessons] = useState([]);
  const [studentsMap, setStudentsMap] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [absentInfo, setAbsentInfo] = useState({ reason: '', makeup: '보강O', date: '', test_time: '', class_time: '' });
  const [moveTargetId, setMoveTargetId] = useState(null);
  const [moveInfo, setMoveInfo] = useState({ date: '', test_time: '', class_time: '' });
  const [makeupMap, setMakeupMap] = useState({});
  const [linkedMakeupLessons, setLinkedMakeupLessons] = useState({});
  const [memoMap, setMemoMap] = useState({});

  const generateTimeSlots = (dateStr) => {
    const date = dayjs(dateStr);
    const isSaturday = date.day() === 6;
    if (isSaturday) {
      const starts = ['10:20', '11:00', '11:40', '12:20', '13:00', '14:00', '14:40', '15:20', '16:00', '16:40'];
      return starts.map(start => {
        const end = dayjs(`${dateStr} ${start}`).add(40, 'minute').format('HH:mm');
        return [start, end];
      });
    } else {
      const slots = [];
      let current = dayjs(`${dateStr} 16:00`);
      const endTime = dayjs(`${dateStr} 22:00`);
      while (current.isSameOrBefore(endTime)) {
        const start = current.format('HH:mm');
        const end = current.add(40, 'minute').format('HH:mm');
        slots.push([start, end]);
        current = current.add(40, 'minute');
      }
      return slots;
    }
  };

  const TIME_SLOTS = generateTimeSlots(selectedDate);

  useEffect(() => { fetchTeachers(); }, []);
  useEffect(() => { if (selectedTeacher && selectedDate) fetchLessons(); }, [selectedTeacher, selectedDate]);
  const fetchTeachers = async () => {
    const { data } = await supabase.from('students').select('teacher').neq('teacher', '').order('teacher');
    const unique = Array.from(new Set(data.map((s) => s.teacher)));
    setTeachers(unique);
  };

  const fetchLessons = async () => {
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('*')
      .eq('date', selectedDate)
      .eq('teacher', selectedTeacher);

    const { data: students } = await supabase.from('students').select('*');
    const map = {};
    students.forEach((s) => (map[s.id] = s));
    setStudentsMap(map);
    setLessons(lessonsData || []);
    setEditingId(null);

    const makeupMap = {};
    const linkedMap = {};
    const memoMap = {};

    for (const lesson of lessonsData || []) {
      if (lesson.type === '메모') {
        memoMap[lesson.time] = lesson;
      }
      if (lesson.status === '보강' && lesson.memo?.includes('원결석일')) {
        const [, originalDate] = lesson.memo.match(/원결석일:\s?([^\s/]+)/) || [];
        if (originalDate) linkedMap[originalDate] = lesson;
      }

      if (lesson.status?.includes('결석')) {
        const { data: linked } = await supabase
          .from('lessons')
          .select('*')
          .ilike('memo', `%원결석일: ${lesson.date}%`)
          .eq('student_id', lesson.student_id)
          .eq('teacher', lesson.teacher)
          .eq('type', '일대일')
          .eq('status', '보강');
        if (linked?.length > 0) makeupMap[lesson.id] = linked[0];
      }
    }

    setMakeupMap(makeupMap);
    setLinkedMakeupLessons(linkedMap);
    setMemoMap(memoMap);
  };

  const handleSaveAbsent = async (lesson) => {
    await supabase.from('lessons').update({
      status: absentInfo.makeup === '보강X' ? '결석(보강X)' : '결석(보강O)',
      memo: `사유:${absentInfo.reason}`,
    }).eq('id', lesson.id);

    if (absentInfo.makeup === '보강O') {
      await supabase.from('lessons')
        .delete()
        .ilike('memo', `%원결석일: ${lesson.date}%`)
        .eq('student_id', lesson.student_id)
        .eq('teacher', lesson.teacher)
        .eq('type', '일대일')
        .eq('status', '보강');

      await supabase.from('lessons').insert({
        student_id: lesson.student_id,
        date: absentInfo.date,
        time: absentInfo.class_time,
        teacher: lesson.teacher,
        type: '일대일',
        status: '보강',
        memo: `원결석일: ${lesson.date} / 사유: ${absentInfo.reason}`,
        makeup_test_time: absentInfo.test_time,
        makeup_lesson_time: absentInfo.class_time,
      });
    }

    // ✅ FCM 푸시 알림 전송
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
  const handleMoveSave = async (lesson) => {
    await supabase.from('lessons')
      .delete()
      .ilike('memo', `%원결석일: ${lesson.date}%`)
      .eq('student_id', lesson.student_id)
      .eq('teacher', lesson.teacher)
      .eq('type', '일대일')
      .eq('status', '보강');

    const reason = lesson.memo.match(/사유:\s?(.+)/)?.[1] || '';

    await supabase.from('lessons').insert({
      student_id: lesson.student_id,
      date: moveInfo.date,
      time: moveInfo.class_time,
      teacher: lesson.teacher,
      type: '일대일',
      status: '보강',
      memo: `원결석일: ${lesson.date} / 사유: ${reason}`,
      makeup_test_time: moveInfo.test_time,
      makeup_lesson_time: moveInfo.class_time,
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
          body: `${student.name} 학생의 보강 수업이 ${moveInfo.date} ${moveInfo.class_time}로 이동되었습니다.`,
        }),
      });
    }

    setMoveTargetId(null);
    fetchLessons();
  };

  const handleReset = async (lesson) => {
    const { data: linked } = await supabase
      .from('lessons')
      .select('id')
      .ilike('memo', `%원결석일: ${lesson.date}%`)
      .eq('student_id', lesson.student_id)
      .eq('teacher', lesson.teacher)
      .eq('type', '일대일')
      .eq('status', '보강');

    if (linked?.length > 0) {
      await supabase.from('lessons').delete().in('id', linked.map((l) => l.id));
    }

    await supabase.from('lessons').update({ status: '', memo: '' }).eq('id', lesson.id);
    fetchLessons();
  };

  const handleDeleteLesson = async (lesson) => {
    await supabase.from('lessons').delete().eq('id', lesson.id);
    fetchLessons();
  };

  const handleMemoChange = async (lesson, memo) => {
    await supabase.from('lessons').update({ memo }).eq('id', lesson.id);
    fetchLessons();
  };

  const handleMemoOnlyChange = async (time, memo) => {
    const existing = memoMap[time];
    if (existing) {
      await supabase.from('lessons').update({ memo }).eq('id', existing.id);
    } else {
      await supabase.from('lessons').insert({
        teacher: selectedTeacher,
        date: selectedDate,
        time,
        type: '메모',
        memo,
      });
    }
    fetchLessons();
  };
  return (
    <div style={{ padding: '30px', backgroundColor: '#fff8dc' }}>
      <h2>일대일 수업 관리</h2>
      <div style={{ marginBottom: '20px' }}>
        <label>선생님 선택: </label>
        <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
          <option value="">-- 선택 --</option>
          {teachers.map((t, idx) => (<option key={idx} value={t}>{t}</option>))}
        </select>
        <label style={{ marginLeft: '20px' }}>날짜 선택: </label>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      <table border="1" cellPadding="8" style={{ width: '100%', backgroundColor: '#ffffff' }}>
        <thead style={{ backgroundColor: '#f5f5dc' }}>
          <tr><th>시간</th><th>학생명</th><th>학교</th><th>학년</th><th>선생님</th><th>상태</th><th>메모</th><th>출결</th><th>삭제</th></tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map(([start, end]) => {
            const lesson = lessons.find((l) => l.time === start && l.type !== '메모');
            const memoOnly = memoMap[start];
            const student = lesson ? studentsMap[lesson.student_id] : null;
            const isAbsent = lesson?.status?.includes('결석');
            const isMakeup = lesson?.status === '보강';
            const makeup = makeupMap[lesson?.id];
            const linkedBack = linkedMakeupLessons[lesson?.date];
            const bgColor = isMakeup ? '#e0f7fa' : 'white';

            let statusText = lesson?.status || '';
            if (isAbsent) {
              const reason = lesson.memo.match(/사유:\s?(.+)/)?.[1] || '';
              statusText += `\n사유: ${reason}`;
              if (makeup) statusText += `\n보강일: ${makeup.date} ${makeup.time}`;
            } else if (isMakeup && lesson.memo?.includes('원결석일')) {
              const [, 원결석일, 사유] = lesson.memo.match(/원결석일:\s?([^\s/]+)\s?\/\s?사유:\s?(.+)/) || [];
              statusText += `\n원결석일: ${원결석일}\n사유: ${사유}`;
            } else if (linkedBack) {
              const [, 원결석일, 사유] = linkedBack.memo?.match(/원결석일:\s?([^\s/]+)\s?\/\s?사유:\s?(.+)/) || [];
              statusText += `\n사유: ${사유 || ''}\n보강일: ${linkedBack.date} ${linkedBack.time}`;
            }

            return (
              <tr key={start} style={{ backgroundColor: bgColor }}>
                <td>{start}~{end}</td>
                <td>{student?.name || ''}</td>
                <td>{student?.school || ''}</td>
                <td>{student?.grade || ''}</td>
                <td>{lesson?.teacher || ''}</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{statusText}</td>
                <td>
                  {lesson ? (
                    <input
                      type="text"
                      defaultValue={!lesson.memo?.startsWith('원결석일') && !lesson.memo?.startsWith('사유:') ? lesson.memo : ''}
                      placeholder="메모 입력"
                      onBlur={(e) => handleMemoChange(lesson, e.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      defaultValue={memoOnly?.memo || ''}
                      placeholder="메모 입력"
                      onBlur={(e) => handleMemoOnlyChange(start, e.target.value)}
                    />
                  )}
                </td>
                <td>
                  {lesson && (
                    lesson.id === editingId ? (
                      <>
                        <input type="text" placeholder="사유" value={absentInfo.reason} onChange={(e) => setAbsentInfo({ ...absentInfo, reason: e.target.value })} />
                        <select value={absentInfo.makeup} onChange={(e) => setAbsentInfo({ ...absentInfo, makeup: e.target.value })}>
                          <option value="보강O">보강O</option>
                          <option value="보강X">보강X</option>
                        </select><br />
                        {absentInfo.makeup === '보강O' && (
                          <>
                            <input type="date" value={absentInfo.date} onChange={(e) => setAbsentInfo({ ...absentInfo, date: e.target.value })} />
                            <input placeholder="test시간" value={absentInfo.test_time} onChange={(e) => setAbsentInfo({ ...absentInfo, test_time: e.target.value })} />
                            <input placeholder="수업시간" value={absentInfo.class_time} onChange={(e) => setAbsentInfo({ ...absentInfo, class_time: e.target.value })} />
                          </>
                        )}
                        <button onClick={() => handleSaveAbsent(lesson)}>저장</button>
                      </>
                    ) : lesson.id === moveTargetId ? (
                      <>
                        <input type="date" value={moveInfo.date} onChange={(e) => setMoveInfo({ ...moveInfo, date: e.target.value })} />
                        <input placeholder="test시간" value={moveInfo.test_time} onChange={(e) => setMoveInfo({ ...moveInfo, test_time: e.target.value })} />
                        <input placeholder="수업시간" value={moveInfo.class_time} onChange={(e) => setMoveInfo({ ...moveInfo, class_time: e.target.value })} />
                        <button onClick={() => handleMoveSave(lesson)}>보강이동 저장</button>
                      </>
                    ) : (
                      <>
                        {!isAbsent && <button onClick={() => handleAbsent(lesson)}>결석</button>}
                        {isAbsent && (
                          <>
                            <button onClick={() => handleReset(lesson)}>초기화</button>
                            {makeup && <button onClick={() => setMoveTargetId(lesson.id)}>보강이동</button>}
                          </>
                        )}
                      </>
                    )
                  )}
                </td>
                <td>
                  {lesson && <button onClick={() => handleDeleteLesson(lesson)}>삭제</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default OneToOneClassPage;
