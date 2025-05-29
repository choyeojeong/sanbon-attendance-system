import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import dayjs from 'dayjs';

function KioskPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setMessage('');
    setIsLoading(true);

    const today = dayjs().format('YYYY-MM-DD');
    const nowTime = dayjs();

    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('phone', phone.trim());

    if (studentError) {
      console.error('학생 조회 오류:', studentError);
      setMessage('학생 조회 오류 발생');
      setIsLoading(false);
      return;
    }

    if (!students || students.length === 0) {
      setMessage('전화번호에 해당하는 학생이 없습니다.');
      setIsLoading(false);
      return;
    }

    const student = students[0];

    const { data: lessons, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('student_id', student.id)
      .eq('date', today)
      .in('type', ['일대일', '독해']);

    if (lessonError) {
      console.error('수업 조회 오류:', lessonError);
      setMessage('수업 조회 오류 발생');
      setIsLoading(false);
      return;
    }

    const matchedLesson = lessons.find((l) => !l.status);

    if (!matchedLesson) {
      setMessage('오늘 출결 가능한 수업이 없습니다.');
      setIsLoading(false);
      return;
    }

    const start = dayjs(`${matchedLesson.date} ${matchedLesson.time}`);
    const end = start.add(90, 'minute');
    const isLate = nowTime.isAfter(start);
    const lateMinutes = nowTime.diff(start, 'minute');

    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        status: isLate ? `출석(지각${lateMinutes}분)` : '출석(정시)',
        start: nowTime.format('HH:mm'),
        end: end.format('HH:mm'),
      })
      .eq('id', matchedLesson.id);

    if (updateError) {
      console.error('출석 업데이트 오류:', updateError);
      setMessage('출석 처리 중 오류가 발생했습니다.');
      setIsLoading(false);
      return;
    }

    // ✅ FCM 푸시 알림 전송
    if (student.fcm_token) {
      try {
        await fetch('https://swwktgersjyakpumlgoj.functions.supabase.co/notify-parent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: student.fcm_token,
            title: '📢 출석 알림',
            body: `${student.name} 학생이 ${matchedLesson.time} 수업에 출석했습니다.`,
          }),
        });
      } catch (error) {
        console.error('알림 전송 오류:', error);
      }
    }

    setMessage(
      isLate
        ? `출석 처리 완료 (지각 ${lateMinutes}분)`
        : '출석 처리 완료 (정시)'
    );
    setIsLoading(false);
    setPhone('');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>📲 키오스크 출석</h2>
        <input
          type="text"
          placeholder="전화번호 입력"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={styles.input}
        />
        <button onClick={handleSubmit} disabled={isLoading} style={styles.button}>
          {isLoading ? '처리 중...' : '출석하기'}
        </button>
        {message && <p style={styles.message}>{message}</p>}
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#fdf5e6',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '5vw',
  },
  card: {
    width: '100%',
    maxWidth: '600px',   // ✅ 기존 400px → 600px 으로 확장
    minWidth: '300px',
    backgroundColor: '#fff8dc',
    padding: '2rem',
    borderRadius: '1rem',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.5rem',
    marginBottom: '1.5rem',
  },
  input: {
    padding: '0.8rem',
    fontSize: '1rem',
    width: '100%',
    marginBottom: '1rem',
    borderRadius: '0.5rem',
    border: '1px solid #ccc',
  },
  button: {
    padding: '0.8rem',
    fontSize: '1rem',
    width: '100%',
    backgroundColor: '#deb887',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
  },
  message: {
    marginTop: '1rem',
    fontSize: '1rem',
    color: '#333',
  },
};

export default KioskPage;
