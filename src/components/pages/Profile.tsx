import React from 'react';
import { Box, Typography, Container, Paper, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Profile: React.FC = () => {
    const navigate = useNavigate();

    // TODO: 실제 사용자 데이터로 대체
    const userData = {
        name: '홍길동',
        level: '중급',
        totalPractice: 25,
        averageScore: 82,
        lastPractice: '2024-04-20',
    };

    const statsData = [
        { label: '총 연습 횟수', value: userData.totalPractice },
        { label: '평균 점수', value: `${userData.averageScore}%` },
        { label: '마지막 연습', value: userData.lastPractice },
    ];

    return (
        <Container maxWidth="md">
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100vh',
                    py: 4,
                    gap: 4,
                }}
            >
                <Typography variant="h4" component="h1" gutterBottom>
                    프로필
                </Typography>

                <Paper
                    elevation={3}
                    sx={{
                        p: 4,
                        width: '100%',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            mb: 4,
                        }}
                    >
                        <Avatar
                            sx={{
                                width: 100,
                                height: 100,
                                mb: 2,
                                bgcolor: 'primary.main',
                            }}
                        >
                            {userData.name[0]}
                        </Avatar>
                        <Typography variant="h5" gutterBottom>
                            {userData.name}
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                            {userData.level} 레벨
                        </Typography>
                    </Box>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '24px',
                        }}
                    >
                        {statsData.map((stat) => (
                            <div key={stat.label}>
                                <Paper
                                    sx={{
                                        p: 2,
                                        textAlign: 'center',
                                        height: '100%',
                                    }}
                                >
                                    <Typography variant="subtitle2" color="text.secondary">
                                        {stat.label}
                                    </Typography>
                                    <Typography variant="h6">{stat.value}</Typography>
                                </Paper>
                            </div>
                        ))}
                    </div>

                    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                        <button
                            onClick={() => navigate('/practice')}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#1976d2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            연습 시작하기
                        </button>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default Profile;
