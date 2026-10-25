const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sxycrtkgawrxyxzttftb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4eWNydGtnYXdyeHl4enR0ZnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NDc0MzksImV4cCI6MjEwODUyMzQzOX0.xHcg0hulzD98ZgoeQpRAQhqnIg1yhMma_-XUATEe49s';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testQuery() {
  const rideId = 'da7aabd8-a860-4123-9909-d33f5f26522d';

  console.log('Testing ride query:');
  const r1 = await supabase.from('rides').select('*').eq('id', rideId).single();
  console.log('Ride status:', r1.status, r1.error?.message || 'OK');

  console.log('Testing members query:');
  const r2 = await supabase.from('ride_members').select('*, profile:profiles(*)').eq('ride_id', rideId);
  console.log('Members status:', r2.status, r2.error?.message || 'OK', r2.data?.length);

  console.log('Testing update status:');
  const r3 = await supabase.from('rides').update({ status: 'active' }).eq('id', rideId);
  console.log('Update status:', r3.status, r3.error?.message || 'OK');
}

testQuery().catch(console.error);
