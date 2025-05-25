import { useNavigate } from 'react-router-dom';

function ClassMenuPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '40px', backgroundColor: '#fffaf0' }}>
      <h2>수업관리 메뉴</h2>
      <button onClick={() => navigate('/classes/one-to-one')} style={{ marginRight: '20px' }}>
        👨‍🏫 일대일 수업 관리
      </button>
      <button onClick={() => navigate('/classes/reading')}>
        📖 독해 수업 관리
      </button>
    </div>
  );
}

export default ClassMenuPage;
