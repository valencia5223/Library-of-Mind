async function testUpdate2() {
  const patchUrl = 'https://tlyhzrridqtbplfozner.supabase.co/rest/v1/restaurants?id=eq.1783910450869';
  const queryUrl = 'https://tlyhzrridqtbplfozner.supabase.co/rest/v1/restaurants?id=eq.1783910450869&select=id,name,rating';
  
  const headers = {
    'apikey': 'sb_publishable_8pClLd0SyBhdiAFaSZF9lw_tLDjMetU',
    'Authorization': 'Bearer sb_publishable_8pClLd0SyBhdiAFaSZF9lw_tLDjMetU',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    console.log('Sending PATCH to update rating to 2...');
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ rating: 2 })
    });
    
    if (patchRes.status >= 400) {
      console.log('PATCH Failed with status:', patchRes.status, await patchRes.text());
      return;
    }
    
    const patchData = await patchRes.json();
    console.log('PATCH Response data (should show updated row):', patchData);

    const queryRes = await fetch(queryUrl, { headers });
    const queryData = await queryRes.json();
    console.log('Query Response (after setting to 2):', queryData);
  } catch (err) {
    console.error('Test error:', err);
  }
}

testUpdate2();
