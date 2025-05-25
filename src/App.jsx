// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentPage from './pages/StudentPage';
import ClassMenuPage from './pages/ClassMenuPage';
import OneToOneClassPage from './pages/OneToOneClassPage';
import ReadingAttendancePage from './pages/ReadingAttendancePage';
import KioskPage from './pages/KioskPage'; // ✅ 키오스크 페이지 추가

function App() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={isLoggedIn ? <DashboardPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/students"
          element={isLoggedIn ? <StudentPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/classes"
          element={isLoggedIn ? <ClassMenuPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/classes/one-to-one"
          element={isLoggedIn ? <OneToOneClassPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/classes/reading"
          element={isLoggedIn ? <ReadingAttendancePage /> : <Navigate to="/login" />}
        />
        <Route path="/kiosk" element={<KioskPage />} /> {/* ✅ 로그인 없이 접근 가능 */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
