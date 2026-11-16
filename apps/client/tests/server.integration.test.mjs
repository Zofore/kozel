import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {io} from 'socket.io-client';

// Run only against the dedicated local integration server. Never a public server.
const base=process.env.KOZEL_TEST_SERVER_URL;
if (!base || !['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Set KOZEL_TEST_SERVER_URL to a local test server');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const name=()=> 'Test'+Array.from(randomBytes(8),n=>String.fromCharCode(65+n%26)).join('');
const call=async(path,body,token)=>{
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
};
const ack=(socket,event,...args)=>new Promise((resolve,reject)=>socket.timeout(5000).emit(event,...args,(error,data)=>error?reject(error):resolve(data)));
const waitFor=(socket,event,predicate=()=>true,ms=25000)=>new Promise((resolve,reject)=>{
  const cb=data=>{if(predicate(data)){clearTimeout(timer);socket.off(event,cb);resolve(data);}};
  const timer=setTimeout(()=>{socket.off(event,cb);reject(new Error('Timed out: '+event));},ms);socket.on(event,cb);
});
const connect=async(token)=>{const socket=io(base,{auth:{token},forceNew:true,autoConnect:false,transports:['websocket']});const connected=waitFor(socket,'connect');socket.connect();await connected;return socket;};
async function account(){const username=name(),password='Test-password-123';assert.equal((await call('/api/register',{username,password,fullname:'Test User',email:'test@example.invalid'})).status,200);const login=await call('/api/login',{username,password});assert.equal(login.status,200);return {username,token:login.data.token};}

test('HTTP authorization, friends, room capacity, invitations and reconnect', {timeout:90000},async()=>{
  const users=await Promise.all(Array.from({length:5},account));
  const [a,b,c,d,e]=users;
  assert.equal((await call('/api/user/update',{username:a.username,status:'unauthorized'})).status,401);
  assert.equal((await call('/api/user/update',{username:b.username,status:'unauthorized'},a.token)).status,403);
  assert.equal((await call('/api/user/update',{username:a.username,status:'ready'},a.token)).status,200);
  assert.equal((await call(`/api/user/profile/${a.username}`,undefined,a.token)).data.status,'ready');
  assert.equal((await call(`/api/friends/list/${b.username}`,undefined,a.token)).status,403);
  assert.equal((await call('/api/friends/respond',{username:b.username,requesterUsername:a.username,action:'accept'},b.token)).status,400);
  assert.equal((await call('/api/friends/request',{username:a.username,targetUsername:b.username},a.token)).status,200);
  assert((await call(`/api/friends/list/${b.username}`,undefined,b.token)).data.requests.some(u=>u.username===a.username));
  assert.equal((await call('/api/friends/respond',{username:b.username,requesterUsername:a.username,action:'accept'},b.token)).status,200);
  const sockets=await Promise.all(users.map(u=>connect(u.token)));
  try {
    const [sa,sb,sc,sd,se]=sockets;
    assert((await ack(sa,'create_dev_room')).error);
    const room=(await ack(sa,'create_room','2v2')).roomId;assert(room);
    assert((await ack(se,'send_invite',{roomId,to:b.username,from:a.username})).error);
    assert((await ack(sb,'accept_invite',{roomId,from:a.username})).error);
    const invitation=waitFor(sb,'receive_invite');
    assert.equal((await ack(sa,'send_invite',{roomId,to:b.username,from:e.username})).success,true);
    assert.equal((await invitation).from,a.username);
    assert.equal((await ack(sb,'accept_invite',{roomId})).roomId,room);
    assert.equal((await ack(sc,'join_room',room)).roomId,room);
    const started=waitFor(sa,'game_state',s=>s.roomId===room&&s.phase==='playing');
    assert.equal((await ack(sd,'join_room',room)).roomId,room);
    assert((await ack(se,'join_room',room)).error);
    const state=await started;assert.equal(state.players.length,4);assert.equal(state.hand.length,6);assert.equal(state.players[1].hand,undefined);
    const disconnected=waitFor(sa,'game_state',s=>s.roomId===room&&s.players[1].connected===false);
    sb.disconnect();await disconnected;
    const replacement=await connect(b.token);sockets.push(replacement);
    const restored=waitFor(replacement,'game_state',s=>s.roomId===room&&s.phase==='playing');
    assert.equal((await ack(replacement,'join_room',room)).roomId,room);
    const view=await restored;assert.equal(view.me,1);assert.equal(view.hand.length,6);assert.equal(view.players[1].connected,true);
    let forbidden=false;se.on('admin_rooms_list',()=>forbidden=true);se.emit('admin_get_rooms');await delay(150);assert.equal(forbidden,false);
  } finally {sockets.forEach(s=>s.disconnect());}
});
