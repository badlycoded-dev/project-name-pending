import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/login/LoginPage';
import HomePage from './pages/home/HomePage';
import SignUpPage from './pages/register/RegisterPage';
import SearchPage from './pages/search/SearchPage';
import TeacherRegisterPage from './pages/register/TeacherRegisterPage';
import AddCoursePage from './pages/instructor/AddCoursePage';
import AccountPage from './pages/account/AccountPage';
import CartPage from './pages/cart/CartPage';
import SettingsPage from './pages/settings/SettingsPage';
import NavBar from './components/NavBar';
import CoursePage from './pages/course/CoursePage';
import EditCoursePage from './pages/course/EditCoursePage';
import ProtectedRoute from './components/ProtectedRoute';
import { SettingsProvider } from './contexts/SettingsContext';
import { CartProvider } from './contexts/CartContext';
import OnBoardingTour from './components/OnBoardingTour';
import { WishlistProvider } from './contexts/WishlistContext';
import WishlistPage from './pages/wishlist/WishlistPage';
import RedeemPage from './pages/redeem/RedeemPage';
import CreatorKeysPage from './pages/key_page/CreatorKeysPage';
import ManageSessionPage from './pages/manage_page/ManageSessionPage';
import LiveSessionPage from './pages/live_session/LiveSessionPage';

function App() {
  return (
    <SettingsProvider>
      <CartProvider>
        <WishlistProvider>
          <BrowserRouter>
            <OnBoardingTour />
            <NavBar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<SignUpPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/apply-teacher" element={<TeacherRegisterPage />} />
              <Route 
                path="/add-course" 
                element={
                  <ProtectedRoute allowedRoles={['create', 'manage', 'admin', 'root']}>
                    <AddCoursePage />
                  </ProtectedRoute>
                } 
              />
              <Route path="/course/:id" element={<CoursePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
              <Route 
                path="/instructor/edit-course/:id" 
                element={
                  <ProtectedRoute roleRequired="teacher">
                    <EditCoursePage />
                  </ProtectedRoute>
                } 
              />
              <Route path="/redeem" element={<RedeemPage />} />
              <Route path="/manage/keys" element={
                <ProtectedRoute allowedRoles={['create', 'manage', 'admin', 'root']}>
                  <CreatorKeysPage />
                </ProtectedRoute>
                } 
              />
              <Route path="/manage/session/:id" element={
                <ProtectedRoute allowedRoles={['create', 'manage', 'admin', 'root']}>
                  <ManageSessionPage />
                </ProtectedRoute>
                } 
              />
              <Route path="/live/:id" element={<LiveSessionPage />} />
            </Routes>
          </BrowserRouter>
        </WishlistProvider>
      </CartProvider>
    </SettingsProvider>
  );
}

export default App;