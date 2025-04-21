import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Container maxWidth="md">
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    gap: 4,
                }}
            >
                <Typography variant="h2" component="h1" gutterBottom>
                    AI 아바타 스피치 코치
                </Typography>
                <Typography variant="h5" align="center" color="text.secondary" paragraph>
                    발음, 억양, 감정 표현을 개선하여 더 나은 스피치를 만들어보세요
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="contained" size="large" onClick={() => navigate('/practice')}>
                        연습 시작하기
                    </Button>
                    <Button variant="outlined" size="large" onClick={() => navigate('/profile')}>
                        프로필 확인
                    </Button>
                </Box>
            </Box>
        </Container>
    );
};

export default Home;
