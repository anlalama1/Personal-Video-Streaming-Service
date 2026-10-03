package com.portfolio.videostreaming.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.portfolio.videostreaming.ui.theme.Amber500
import com.portfolio.videostreaming.ui.theme.HeritageBlack
import com.portfolio.videostreaming.ui.theme.Stone400

sealed class BottomNavItem(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    object Home : BottomNavItem("catalog", "Home", Icons.Default.Home)
    object Add : BottomNavItem("local_picker", "Add", Icons.Default.AddCircle)
    object Review : BottomNavItem("family_review", "Review", Icons.Default.Checklist)
    object Profile : BottomNavItem("profile_modal", "Profile", Icons.Default.Person)
}

/**
 * ============================================================================
 * Alexandria Heritage Bottom Navigation Bar
 * ============================================================================
 * Enterprise Architecture Strategy: Mobile Navigation Hierarchy.
 * Renders Home (Catalog), Add (FamilyAlbum-Style Local Video Picker), Review
 * (Family Vault Review Board), and Profile (Account Details Dialog).
 */
@Composable
fun AlexandriaBottomBar(
    currentRoute: String?,
    onNavigate: (BottomNavItem) -> Unit,
    modifier: Modifier = Modifier
) {
    val items = listOf(
        BottomNavItem.Home,
        BottomNavItem.Add,
        BottomNavItem.Review,
        BottomNavItem.Profile
    )

    NavigationBar(
        modifier = modifier,
        containerColor = HeritageBlack,
        tonalElevation = 8.dp
    ) {
        items.forEach { item ->
            val isSelected = currentRoute == item.route

            NavigationBarItem(
                selected = isSelected,
                onClick = { onNavigate(item) },
                icon = {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = item.title,
                        modifier = Modifier.size(24.dp)
                    )
                },
                label = {
                    Text(
                        text = item.title,
                        fontSize = 10.sp,
                        fontWeight = if (isSelected) FontWeight.Black else FontWeight.Medium
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = Amber500,
                    selectedTextColor = Amber500,
                    unselectedIconColor = Stone400,
                    unselectedTextColor = Stone400,
                    indicatorColor = Amber500.copy(alpha = 0.15f)
                )
            )
        }
    }
}
