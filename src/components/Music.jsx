const playList=[
    {id:1,name:"城市晚风", artist:"轻音乐合集",cover:'🌆'},
    {id:2,name:"旅途记录", artist:"旅行BGM",cover:'🏖'},
    {id:3,name:"午后咖啡", artist:"治愈系",cover:'☕'},
    {id:4,name:"星空下", artist:"纯音乐",cover:'🌌'}
];

export default function Music(){
    return (
        <div style={{padding:'40px',maxWidth:'800px',margin:'0 auto'}}>
            <h2 style={{color:"#2c4440",marginBottom:'24px'}}>拾光音乐</h2>
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                {playList.map(song =>(
                    <div key={song.id} style={{
                        padding:'20px',background:'white',borderRadius:'12px',
                        display:"flex",alignItems:"center",gap:"16px",
                        boxShadow:'0 2px 8px rgba(0,0,0,0.08)', cursor:'pointer'
                    }}>
                        <div style={{fontSize:'32px'}}>{song.cover}</div>
                        <div style={{flex:1}}>
                            <h4 style={{msrgin:0,color:'#2c4440'}}>{song.name}</h4>
                            <p style={{margin:'4px 0 0',color:"#688480",fontSize:'14px'}}>{song.artist}</p>
                        </div>
                        <button style={{
                            padding:'8px 16px',border:"none",borderRadius:'6px',
                            background:"48a898",color:'white',cursor:'pointer'
                        }}>播放</button>
                    </div>
                ))}
            </div>
        </div>
    );
}