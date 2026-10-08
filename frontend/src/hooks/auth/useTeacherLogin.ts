import { logInTeacher } from '../../api/auth/logInTeacher';

// Sends the sign-in request and returns the user.
//
// It deliberately does NOT put the user into AuthContext. The page decides
// when to do that (TeacherSignIn's handleAuthSuccess), so the form can finish
// its loading state first. Setting the user here made the page redirect the
// instant the server answered, before the form was done.
const useTeacherLogin = () => {
  const login = (credentials: { email: string; password: string; rememberMe: boolean }) =>
    logInTeacher(credentials);

  return { login };
};

export default useTeacherLogin;
