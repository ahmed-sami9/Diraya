import { signUpTeacher } from '../../api/auth/signUpTeacher';

// Sends the sign-up request.
//
// Signing up no longer signs the teacher in, so there is no user to store:
// the result is only the email address waiting to be confirmed.
//
// Errors are NOT caught here on purpose. They pass straight up to the
// component, which decides what UI to show based on error.code.
const useTeacherSignUp = () => {
  const signUp = (credentials: { email: string; password: string; fullName: string }) =>
    signUpTeacher(credentials);

  return { signUp };
};

export default useTeacherSignUp;
