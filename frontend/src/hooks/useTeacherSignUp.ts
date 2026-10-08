import { signUpTeacher } from '../api/signUpTeacher';
import { useAuth } from '../context/AuthContext';

const useTeacherSignUp = () => {
  const { setUser } = useAuth();

  // Errors are NOT caught here on purpose. They pass straight up to the
  // component, which decides what UI to show based on error.code.
  const signUp = async (credentials: { email: string; password: string; fullName: string }) => {
    const data = await signUpTeacher(credentials);
    setUser(data);
    return data;
  };

  return { signUp };
};

export default useTeacherSignUp;
