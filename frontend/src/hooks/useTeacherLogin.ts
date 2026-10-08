import { logInTeacher } from '../api/logInTeacher';
import { useAuth } from '../context/AuthContext';

const useTeacherLogin = () => {
  const { setUser } = useAuth();

  const login = async (credentials: { email: string; password: string; rememberMe: boolean }) => {
    const user = await logInTeacher(credentials);

    setUser(user);

    return user;
  };

  return { login };
};

export default useTeacherLogin;
