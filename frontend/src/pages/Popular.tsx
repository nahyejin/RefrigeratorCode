import React from 'react';
import BottomNavBar from '../components/BottomNavBar';
import TopNavBar from '../components/TopNavBar';

const Popular = () => {
  return (
    <>
      <TopNavBar />
      <div>Popular Page</div>
      <BottomNavBar activeTab="popularity" />
    </>
  );
};
 
export default Popular; 