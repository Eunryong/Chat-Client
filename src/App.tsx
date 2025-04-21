import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createTheme } from '@mui/material/styles';

// Pages
import Home from './components/pages/Home';
import Practice from './components/pages/Practice';
import Feedback from './components/pages/Feedback';
import Profile from './components/pages/Profile';

// Theme
const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

function App() {
    return (
        <RecoilRoot>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Router>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/practice" element={<Practice />} />
                        <Route path="/feedback" element={<Feedback />} />
                        <Route path="/profile" element={<Profile />} />
                    </Routes>
                </Router>
            </ThemeProvider>
        </RecoilRoot>
    );
}

export default App;
