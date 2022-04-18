import React, { useContext } from 'react';
import { AuthenticationContext } from '@utils/context';
import SignUp from './SignUp';
import SignIn from './SignIn';

const ProtectableComponentWrapper = ({ children }) => {
    const authentication = useContext(AuthenticationContext);

    if (authentication) {
        const { loading, isAuthenticationRequired, isSignedIn } =
            authentication;

        if (loading) {
            return <p>Loading authentication data...</p>;
        }

        // prompt if user would like to enable biometric lock when the app first run
        if (isAuthenticationRequired === undefined) {
            // Skip authentication screen if new wallet pointed at URI
            const params = (new URL(window.location)).searchParams;
            if (!params.get('uri')) {
                return <SignUp />;
            }
        }

        // prompt user to sign in
        if (isAuthenticationRequired && !isSignedIn) {
            return <SignIn />;
        }
    }

    // authentication = null  => authentication is not supported
    return <>{children}</>;
};

export default ProtectableComponentWrapper;
