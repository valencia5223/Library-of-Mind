const anonKey = 'sb_publishable_8pClLd0SyBhdiAFaSZF9lw_tLDjMetU';
const url = 'https://tlyhzrridqtbplfozner.supabase.co/rest/v1/restaurants?limit=1';

fetch(url, {
  headers: {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`
  }
})
.then(res => res.json())
.then(data => {
  console.log('Query result keys:', data.length > 0 ? Object.keys(data[0]) : 'Empty table');
})
.catch(err => console.error(err));
