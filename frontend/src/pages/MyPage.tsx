import React from 'react';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';

const MyPage = () => {
  return (
    <>
      <TopNavBar />
      <div>My Page</div>
      <BottomNavBar activeTab="mypage" />
    </>
  );
};
 
export default MyPage; 