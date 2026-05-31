const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const match = await prisma.match.findFirst();
    console.log("MATCH:", match);
    if (match) {
      const res = await fetch(`http://localhost:4000/api/chats/${match.id}/messages`);
      const data = await res.json();
      console.log("STATUS:", res.status);
      console.log("RESPONSE:", JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
