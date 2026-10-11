import {useState} from 'react';

export default function Agent(){
    const [messages,setMessages] = useState([
        {role:'agent',text:'你好，我是拾光记忆助手,可以帮你整理记忆，生成游记哦~'},
    ]);
    const [input,setInput] = useState('');

    const sendMsg = () =>{
        if(!input.trim()) return;
        setMessages([...messages,{role:"user",text:input}]);
        setInput('');
        setTimeout(()=>{
            setMessages(prev => [...prev,{role:'agent',text:"正在思考中..."}]);
        },500);
    }

    return (
        <div style={{padding: '40px',maxWidth:"800px",margin:'0 auto',height:'calc(100vh-180px)',display:'flex',felxDirection:'column'}}>
            <h2 style={{color:"#2c4440",marginBottom:"24px"}}>拾光agent</h2>
            <div style={{flex:1,overflowY:"auto",background:"white",borderRadius:'12px',padding:"20px",marginBottom:'16px'}}>
                {messages.map((msg,idx)=>(
                    <div key={idx} style={{
                        marginBottom:'12px',
                        textAlign: msg.role === 'user'?'right':'left'
                    }}>
                        <span style={{
                            display:'inline-block',padding:'10px 16px',borderRadius:"12px",
                            background: msg.role === 'user'? "#48a898":"#f0f9f7",
                            color:msg.role === 'user'?'white':"2c4440"
                        }}>
                            {msg.text}
                        </span>
                    </div>
                ))}
            </div>
            <div style={{display:'flex',gap:'8px'}}>
                <input
                type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown ={e =>e.key === 'Enter' && sendMsg()}
                placeholder='和拾光助手说点什么...'
                style={{flex:1,padding:'12px',borderRadius:'8px',border:'1px solid #ddd'}}
                />
                <button onClick={sendMsg} style={{padding:'12px 14px',border:'none',borderRadius:'8px',background:'#48a898',color:"white",cursor:'pointer'}}>发送</button>
            </div>
        </div>
    )

}