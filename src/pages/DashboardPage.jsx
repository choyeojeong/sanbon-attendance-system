// src/pages/DashboardPage.jsx
import { useNavigate } from 'react-router-dom';

function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>관리자 대시보드</h2>
      <div style={styles.buttonContainer}>
        <button style={styles.button} onClick={() => navigate('/students')}>
          🧑‍🎓 학생관리
        </button>
        <button style={styles.button} onClick={() => navigate('/classes')}>
          📚 수업관리
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#f5f5dc',
    height: '100vh',
    paddingTop: '100px',
    textAlign: 'center',
  },
  title: {
    fontSize: '32px',
    marginBottom: '40px',
    color: '#333',
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '30px',
  },
  button: {
    fontSize: '18px',
    padding: '15px 30px',
    backgroundColor: '#deb887',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};

export default DashboardPage;
