import {useState, useEffect} from "react";;
import MapContainer from "./components/MapContainer.jsx";
import Login from "./components/Login.jsx";
import Register from "./components/Register.jsx";

function App() {
  const [page,setPage] = useState('login');
  const [isLogin,setIsLogin] = useState(false);
  const [loading,setLoading] = useState(true);

  useEffect(() =>{
    const chekLogin = async () =>{
      try{
        const res = await fetch("http://localhost:3001/api/get-user",{
        credentials: "include"
        });
        const data = await res.json();;
        if(data.isLogin){
          setIsLogin(true);
          setPage('map');
        }  
      } catch(err){
        console.log("后端未启动，当作未登录");
      } finally{
        setLoading(false);
      }
  };
  chekLogin();
},[]);

  if(loading){
    return <div style={{textAlign:'center',marginTop:"100px"}}>加载中...</div>;
  }

  if(page === "login"){
    return (
      <Login 
       switchToRegister={() => setPage("register")}
       onLoginSuccess={
        () => {
          setIsLogin(true);
          setPage("map");
        }
       }
      />
    );
  }

  if(page === "register"){
    return (
      <Register 
       switchToLogin={() => setPage("login")}
       onRegisterSuccess={
        () => {
          setIsLogin(true);
          setPage("map");
        }
       }
      />
    );
  }

  if(page === "map" && isLogin){
    return <MapContainer />;
  }
  return null;
}

export default App;