import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.portfolio.videostreaming.R
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Parchment
import com.portfolio.videostreaming.ui.theme.Stone400

@Composable
fun AlexandriaNavbar(
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = HeritageBlack.copy(alpha = 0.85f),
        shadowElevation = 8.dp
    ) {
        Column(modifier = Modifier.statusBarsPadding()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp)
                    .padding(horizontal = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Logo and Brand
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.logo_flat),
                        contentDescription = "Alexandria+ Logo",
                        modifier = Modifier
                            .height(52.dp) // Larger presence
                            .offset(x = 3.dp, y = 1.dp), // Moved 'up and to the right' relative to container, aligned to baseline
                        contentScale = ContentScale.Fit
                    )
                    Text(
                        text = "LEXANDRIA+",
                        color = Parchment,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-0.5).sp,
                        modifier = Modifier.offset(x = (-12).dp) // Tighter lockup to swallow remaining padding
                    )
                }

                // Desktop-style Links (Simplified for Mobile)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    Text(
                        text = "HOME",
                        color = Parchment,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp
                    )
                    
                    // Profile Circle with Logout action
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Amber500)
                            .clickable { onSignOut() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "AL",
                            color = HeritageBlack,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            }
            
            // Subtle bottom border
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Parchment.copy(alpha = 0.1f))
            )
        }
    }
}
